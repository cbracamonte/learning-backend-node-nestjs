/**
 * memory-profiling.ts — Profiling de memoria, WeakRef, FinalizationRegistry
 *
 * Objetivo: medir el uso de memoria en el tiempo, usar WeakRef para caches
 * sin retención, FinalizationRegistry para detectar recolección, y patrones
 * para evitar fugas en producción.
 */

function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(3) + ' MB';
}

function snapshot(): NodeJS.MemoryUsage {
  return process.memoryUsage();
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 1: process.memoryUsage() — monitoreo continuo del heap
//
// En producción se envían estas métricas a Datadog, Prometheus, etc.
// Un heapUsed que sólo crece indica una fuga de memoria.
// ─────────────────────────────────────────────────────────────────────────────
function demo1MemoryMonitoring(): void {
  console.log('─── DEMO 1: Monitoreo de memoria con process.memoryUsage() ───');

  interface MemSnapshot {
    label: string;
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  }

  const history: MemSnapshot[] = [];

  function record(label: string): void {
    const m = snapshot();
    history.push({ label, heapUsed: m.heapUsed, heapTotal: m.heapTotal, rss: m.rss, external: m.external });
  }

  record('baseline');

  // Asignación masiva
  const bigArray: string[] = [];
  for (let i = 0; i < 100_000; i++) {
    bigArray.push(`entry-${i}-${'x'.repeat(20)}`);
  }
  record('después de 100k strings');

  // Liberar referencia
  bigArray.length = 0;
  record('después de vaciar array');

  // Imprimir tabla
  console.log('\n  label                           heapUsed     heapTotal    rss');
  console.log('  ─────────────────────────────────────────────────────────────────');
  for (const s of history) {
    const label = s.label.padEnd(32);
    console.log(`  ${label} ${mb(s.heapUsed).padStart(10)}   ${mb(s.heapTotal).padStart(10)}   ${mb(s.rss).padStart(10)}`);
  }

  const growth = history[1].heapUsed - history[0].heapUsed;
  const afterFree = history[2].heapUsed - history[0].heapUsed;
  console.log(`\n  Crecimiento durante asignación: +${mb(growth)}`);
  console.log(`  Delta post-clear (GC no síncrono): ${mb(Math.abs(afterFree))}`);
  console.log('  💡 Para forzar GC en tests: node --expose-gc → global.gc()\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 2: WeakRef — caché sin retener objetos
//
// WeakRef permite guardar una referencia a un objeto sin impedir su recolección.
// Si el GC lo colecta, weakRef.deref() devuelve undefined.
// Patrón clásico: caché memoize que no fuerza vivir los resultados.
// ─────────────────────────────────────────────────────────────────────────────
function demo2WeakRef(): void {
  console.log('─── DEMO 2: WeakRef — caché sin retención de objetos ───');

  // Cache con WeakRef: guarda resultados pesados sin bloquear al GC
  class WeakCache<K extends object, V extends object> {
    private store = new Map<K, WeakRef<V>>();

    set(key: K, value: V): void {
      this.store.set(key, new WeakRef(value));
    }

    get(key: K): V | undefined {
      const ref = this.store.get(key);
      if (!ref) return undefined;
      const value = ref.deref();       // deref() → objeto vivo, o undefined si fue GC'd
      if (value === undefined) {
        this.store.delete(key);         // cleanup: eliminar entrada huérfana
        return undefined;
      }
      return value;
    }

    get size(): number { return this.store.size; }
  }

  interface ComputedResult { value: number; timestamp: number }

  const key1 = { query: 'SELECT * FROM users' };
  const key2 = { query: 'SELECT * FROM orders' };
  const result1: ComputedResult = { value: 42, timestamp: Date.now() };
  const result2: ComputedResult = { value: 99, timestamp: Date.now() };

  const cache = new WeakCache<object, ComputedResult>();
  cache.set(key1, result1);
  cache.set(key2, result2);

  console.log(`  Cache entries: ${cache.size}`);
  console.log(`  key1 → ${JSON.stringify(cache.get(key1))}`);
  console.log(`  key2 → ${JSON.stringify(cache.get(key2))}`);

  // Si result1 pierde todas sus referencias fuertes, el GC puede recolectarlo
  // y cache.get(key1) devolverá undefined en el siguiente acceso.
  console.log('\n  ✅ WeakRef: el GC puede liberar el valor si no hay otras referencias');
  console.log('  ✅ deref() === undefined → el objeto fue recolectado (revisa cache miss)\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 3: FinalizationRegistry — detectar cuándo un objeto es recolectado
//
// Permite registrar un callback que se ejecuta DESPUÉS de que el GC elimina
// un objeto. Útil para diagnóstico, cleanup de recursos externos, y logging.
// ─────────────────────────────────────────────────────────────────────────────
function demo3FinalizationRegistry(): void {
  console.log('─── DEMO 3: FinalizationRegistry — callback al ser recolectado ───');

  // Registro: cuando el GC colecte el objeto, llama al callback con el "token"
  const registry = new FinalizationRegistry((token: string) => {
    console.log(`  🗑️  GC recolectó el objeto con token: "${token}"`);
  });

  function createTrackedObject(name: string): object {
    const obj = { name, data: new Array(1000).fill(name) };
    registry.register(obj, `objeto-${name}`);   // registrar con token descriptivo
    return obj;
  }

  // Creamos objetos dentro de una función para que pierdan scope al salir
  (() => {
    const temp1 = createTrackedObject('alpha');
    const temp2 = createTrackedObject('beta');
    console.log(`  Objetos creados: "${(temp1 as any).name}", "${(temp2 as any).name}"`);
    console.log('  Al salir del IIFE, pierden sus referencias...');
    void temp1; void temp2;
  })();

  console.log('  IIFE terminó — objetos sin referencia (GC determinará cuándo limpiar)');
  console.log('  💡 FinalizationRegistry NO garantiza CUÁNDO se llama el callback');
  console.log('     (depende del ciclo de GC — puede ser inmediato o nunca en procesos cortos)\n');

  // Use case real: limpiar recursos nativos (file descriptors, timers)
  const fileRegistry = new FinalizationRegistry((fd: number) => {
    console.log(`  🔧 Cleanup: cerrando file descriptor ${fd} automáticamente`);
    // En código real: fs.close(fd, () => {})
  });

  const fileHandle = { fd: 42, path: '/tmp/data.bin' };
  fileRegistry.register(fileHandle, fileHandle.fd);
  console.log(`  File handle registrado (fd=${fileHandle.fd}) para auto-cleanup\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 4: Detectar fuga de memoria con snapshots periódicos
//
// Patrón para tests de carga o diagnóstico: registrar heapUsed cada N ms
// y detectar si hay crecimiento sostenido (trend lineal ascendente = leak).
// ─────────────────────────────────────────────────────────────────────────────
function demo4LeakDetection(): Promise<void> {
  return new Promise((resolve) => {
    console.log('─── DEMO 4: Detección de fuga con snapshots periódicos ───');

    interface HeapSnapshot { t: number; heap: number }
    const snapshots: HeapSnapshot[] = [];
    const leakyStore: object[] = [];    // simula acumulación progresiva

    let tick = 0;
    const MAX_TICKS = 6;

    const interval = setInterval(() => {
      // Simula trabajo que "filtra": acumula objetos sin liberarlos
      for (let i = 0; i < 2_000; i++) {
        leakyStore.push({ tick, i, payload: `leak-${tick}-${i}` });
      }

      const h = process.memoryUsage().heapUsed;
      snapshots.push({ t: tick, heap: h });
      tick++;

      if (tick >= MAX_TICKS) {
        clearInterval(interval);

        // Analizar tendencia: ¿heapUsed siempre crece?
        console.log('\n  tick   heapUsed     delta');
        console.log('  ──────────────────────────────');
        for (let i = 0; i < snapshots.length; i++) {
          const delta = i === 0 ? 0 : snapshots[i].heap - snapshots[i - 1].heap;
          const sign  = delta > 0 ? '▲' : delta < 0 ? '▼' : '─';
          console.log(`  ${String(snapshots[i].t).padStart(3)}    ${mb(snapshots[i].heap).padStart(10)}   ${sign} ${mb(Math.abs(delta))}`);
        }

        const alwaysGrowing = snapshots.every((s, i) => i === 0 || s.heap >= snapshots[i - 1].heap);
        console.log(`\n  ¿heapUsed siempre crece? → ${alwaysGrowing ? '⚠️  SÍ — posible leak' : '✅ No — crecimiento normal'}`);
        console.log(`  Total objetos acumulados: ${leakyStore.length}`);
        console.log(`  Total acumulado: +${mb(snapshots[snapshots.length - 1].heap - snapshots[0].heap)}`);
        console.log('\n  ✅ Pattern: si la tendencia es siempre ascendente → revisar retenciones\n');

        leakyStore.length = 0;   // cleanup
        resolve();
      }
    }, 50);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 5: Límites de V8 y flags útiles
// ─────────────────────────────────────────────────────────────────────────────
function demo5V8Flags(): void {
  console.log('─── DEMO 5: Límites de V8 y flags de diagnóstico ───');

  const mem = process.memoryUsage();
  console.log(`  heapUsed  actual : ${mb(mem.heapUsed)}`);
  console.log(`  heapTotal actual : ${mb(mem.heapTotal)}`);
  console.log(`  rss       actual : ${mb(mem.rss)}`);

  console.log('\n  Flags útiles de V8 / Node.js:');

  const flags = [
    ['--max-old-space-size=4096', 'Límite del Old Space en MB (default ~1.5 GB en 64-bit)'],
    ['--expose-gc',               'Expone global.gc() para forzar GC en tests'],
    ['--inspect',                 'Habilita Chrome DevTools para heap snapshots'],
    ['--heap-prof',               'Genera perfil de heap al terminar el proceso'],
    ['--trace-gc',                'Imprime cada ciclo de GC con duración y tipo'],
    ['--trace-gc-verbose',        'Traza detallada del GC (New/Old Space por separado)'],
  ];

  for (const [flag, desc] of flags) {
    console.log(`  ${flag.padEnd(30)} → ${desc}`);
  }

  console.log('\n  Ejemplo de monitoreo en producción:');
  console.log('    setInterval(() => {');
  console.log('      const { heapUsed, heapTotal } = process.memoryUsage();');
  console.log('      metrics.gauge("heap_used_mb", heapUsed / 1e6);');
  console.log('      if (heapUsed / heapTotal > 0.9) {');
  console.log('        logger.warn("Heap usage > 90% — posible fuga");');
  console.log('      }');
  console.log('    }, 10_000);\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main_advanced(): Promise<void> {
  console.log('========================================');
  console.log(' Memory Profiling — Advanced            ');
  console.log('========================================\n');

  demo1MemoryMonitoring();
  demo2WeakRef();
  demo3FinalizationRegistry();
  await demo4LeakDetection();
  demo5V8Flags();

  console.log('========================================');
  console.log(' Resumen                                ');
  console.log('========================================');
  console.log('  process.memoryUsage()   : heapUsed, heapTotal, rss, external');
  console.log('  WeakRef                 : referencia débil, deref() → objeto o undefined');
  console.log('  FinalizationRegistry    : callback cuando el GC recolecta un objeto');
  console.log('  Snapshot trending       : heapUsed siempre creciendo → fuga probable');
  console.log('  --max-old-space-size    : límite del heap en producción');
  console.log('  --heap-prof / --inspect : herramientas de diagnóstico');
}

main_advanced().catch(console.error);
