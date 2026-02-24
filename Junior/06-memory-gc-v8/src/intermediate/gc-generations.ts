/**
 * gc-generations.ts — GC Generacional, Fugas de Memoria y WeakMap
 *
 * Objetivo: entender por qué V8 divide el heap en generaciones, cómo detectar
 * una fuga de memoria con métricas, y cómo WeakMap/WeakSet evitan retenciones.
 */
import { EventEmitter } from 'node:events';

function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 1: GC Generacional — New Space vs Old Space
//
// V8 divide el heap en dos generaciones:
//   New Space (Nursery): objetos recién creados, GC muy frecuente (Minor GC)
//   Old Space          : objetos que sobrevivieron 2+ ciclos (Major GC / Mark-Sweep)
//
// "La mayoría de los objetos mueren jóvenes" → Generational Hypothesis
// ─────────────────────────────────────────────────────────────────────────────
function demo1Generations(): void {
  console.log('─── DEMO 1: GC Generacional — New Space vs Old Space ───');
  console.log('');
  console.log('  New Space (Nursery / Young Generation):');
  console.log('    Size  : ~1–8 MB por default');
  console.log('    GC    : Minor GC (Scavenger) — muy rápido (~1ms)');
  console.log('    Regla : objetos que no sobreviven → liberados aquí');
  console.log('');
  console.log('  Old Space (Tenured / Old Generation):');
  console.log('    Size  : cientos de MB (límite con --max-old-space-size)');
  console.log('    GC    : Major GC (Mark-Sweep-Compact) — más lento (~100ms+)');
  console.log('    Regla : objetos promovidos desde New Space tras 2 Minor GCs');
  console.log('');

  // Medir qué hace la asignación masiva al heap
  const snap1 = process.memoryUsage().heapUsed;

  // Objetos de vida corta → idealmente quedan y mueren en New Space
  for (let i = 0; i < 10_000; i++) {
    const temp = { x: i, y: i * 2 };   // se crea y se descarta en cada iteración
    void temp;
  }

  const snap2 = process.memoryUsage().heapUsed;
  console.log(`  10.000 objetos temporales: delta heap = ${mb(snap2 - snap1)}`);
  console.log('  (pequeño delta → Minor GC ya los colectó)\n');

  // Objetos de vida larga → promovidos a Old Space
  const longLived: object[] = [];
  const snap3 = process.memoryUsage().heapUsed;
  for (let i = 0; i < 10_000; i++) {
    longLived.push({ id: i, data: `item-${i}` });   // sobrevivirán Minor GC
  }
  const snap4 = process.memoryUsage().heapUsed;
  console.log(`  10.000 objetos retenidos: +${mb(snap4 - snap3)}`);
  console.log('  (estos serán promovidos a Old Space → sólo Major GC los libera)\n');

  // Liberar referencia
  longLived.length = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 2: Memory Leak — el patrón más común: Map que nunca se limpia
//
// Un Map guarda referencias FUERTES: los objetos nunca se colectan mientras
// el Map exista. Si agregas sin eliminar → crecimiento ilimitado del heap.
// ─────────────────────────────────────────────────────────────────────────────
function demo2MemoryLeak(): void {
  console.log('─── DEMO 2: Fuga de memoria — Map con referencias fuertes ───');

  // ⚠️ PATRÓN PROBLEMÁTICO: cache que nunca expira
  const leakyCache = new Map<string, object>();

  const snapBefore = process.memoryUsage().heapUsed;

  // Simulamos 5000 requests que agregan datos al cache sin nunca limpiar
  for (let i = 0; i < 5_000; i++) {
    const userId = `user-${i}`;
    leakyCache.set(userId, {
      id: userId,
      profile: new Array(100).fill(`data-${i}`),   // ~800 bytes por entrada
      timestamp: Date.now(),
    });
  }

  const snapAfter = process.memoryUsage().heapUsed;
  console.log(`  Cache acumuló 5.000 entradas: +${mb(snapAfter - snapBefore)}`);
  console.log(`  Map size: ${leakyCache.size} entradas — nunca se liberarán`);
  console.log('  ⚠️  Si esto corre en un servidor, el heap crece sin límite\n');

  // ✅ SOLUCIÓN 1: limpiar entradas antiguas (TTL/LRU)
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of leakyCache) {
    const entry = value as { timestamp: number };
    if (now - entry.timestamp > 0) {   // simula TTL expirado
      leakyCache.delete(key);
      cleaned++;
    }
    if (cleaned >= 2_500) break;   // limpiar la mitad para demo
  }
  console.log(`  ✅ Solución 1: limpiar por TTL → eliminadas ${cleaned} entradas`);
  console.log(`  Map size ahora: ${leakyCache.size}\n`);
  leakyCache.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 3: WeakMap vs Map — referencias débiles
//
// WeakMap guarda referencias DÉBILES: si el objeto clave no tiene otras
// referencias, el GC puede recolectarlo aunque esté en el WeakMap.
// Perfecto para metadatos asociados a objetos sin impedir su recolección.
// ─────────────────────────────────────────────────────────────────────────────
function demo3WeakMap(): void {
  console.log('─── DEMO 3: WeakMap — referencias débiles ───');

  // Map fuerte: el objeto vive mientras el Map exista
  const strongMap = new Map<object, string>();
  let obj1: object | null = { id: 1 };
  strongMap.set(obj1, 'metadata-fuerte');
  console.log(`  Map fuerte tiene ${strongMap.size} entrada(s)`);
  obj1 = null;   // perdemos nuestra referencia...
  console.log(`  Después de obj1 = null, Map sigue teniendo: ${strongMap.size} entrada(s)`);
  console.log('  ⚠️  El objeto NUNCA se recolecta mientras el Map exista\n');

  // WeakMap débil: el GC puede recolectar el objeto aunque esté en el WeakMap
  const weakMap = new WeakMap<object, string>();
  let obj2: object | null = { id: 2 };
  weakMap.set(obj2, 'metadata-débil');
  console.log(`  WeakMap: obj2 registrado con metadata`);
  console.log(`  ¿weakMap.has(obj2)? ${weakMap.has(obj2)}`);
  obj2 = null;   // cuando el GC corra, el objeto y su entrada en WeakMap desaparecerán
  console.log(`  obj2 = null → el objeto es elegible para GC`);
  console.log('  ✅ WeakMap no puede iterarse — no hay riesgo de leak por enumeración\n');

  // Caso de uso real: metadata de nodos DOM / objetos sin acoplar lifecycle
  const metadata = new WeakMap<object, { createdAt: number; hits: number }>();

  function trackRequest(req: object): void {
    if (!metadata.has(req)) {
      metadata.set(req, { createdAt: Date.now(), hits: 0 });
    }
    const meta = metadata.get(req)!;
    meta.hits++;
  }

  const request = { url: '/api/users', method: 'GET' };
  trackRequest(request);
  trackRequest(request);
  trackRequest(request);
  const reqMeta = metadata.get(request)!;
  console.log(`  Request hits: ${reqMeta.hits} (almacenado en WeakMap)`);
  console.log('  ✅ Cuando "request" se descarte, metadata se libera automáticamente\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 4: Event Listener Leak — el clásico en Node.js
//
// Registrar listeners sin removerlos es la fuga más común en servidores Node.
// EventEmitter guarda una referencia fuerte a cada callback registrado.
// ─────────────────────────────────────────────────────────────────────────────
function demo4EventListenerLeak(): void {
  console.log('─── DEMO 4: Event Listener Leak — el más común en servidores ───');

  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);   // silenciar la advertencia del demo

  // ⚠️ Patrón problemático: registrar sin removeListener
  function leakyPattern() {
    // Imagina que esto se llama en cada request HTTP
    const handler = () => { /* procesa datos */ };
    emitter.on('data', handler);   // handler queda "colgado" para siempre
  }

  // Simular 10 "requests" que registran listeners y no los limpian
  for (let i = 0; i < 10; i++) {
    leakyPattern();
  }
  console.log(`  ⚠️  Listeners activos en 'data': ${emitter.listenerCount('data')}`);
  console.log('  Cada request añadió un listener que nunca se elimina\n');

  // ✅ Solución 1: removeListener / off
  emitter.removeAllListeners('data');
  console.log(`  ✅ removeAllListeners → listeners ahora: ${emitter.listenerCount('data')}`);

  // ✅ Solución 2: .once() — se registra y se auto-elimina tras la primera emisión
  let onceCount = 0;
  for (let i = 0; i < 5; i++) {
    emitter.once('data', () => { onceCount++; });
  }
  console.log(`  .once() registrados: ${emitter.listenerCount('data')}`);
  emitter.emit('data');   // dispara y auto-elimina todos los .once()
  console.log(`  Después de emit: ${emitter.listenerCount('data')} listeners (auto-removed)`);
  console.log(`  Callbacks ejecutados: ${onceCount}`);

  // ✅ Solución 3: guardar referencia al handler para poder removerlo
  const specificHandler = () => { /* handler */ };
  emitter.on('data', specificHandler);
  console.log(`\n  Listener añadido: ${emitter.listenerCount('data')}`);
  emitter.off('data', specificHandler);   // .off() = alias de .removeListener()
  console.log(`  Listener removido: ${emitter.listenerCount('data')}`);
  console.log('  ✅ Siempre guarda la referencia al handler si necesitas eliminarlo\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('========================================');
  console.log(' GC Generacional — Intermediate         ');
  console.log('========================================\n');

  demo1Generations();
  demo2MemoryLeak();
  demo3WeakMap();
  demo4EventListenerLeak();

  console.log('========================================');
  console.log(' Resumen                                ');
  console.log('========================================');
  console.log('  New Space  : objetos jóvenes, Minor GC frecuente y rápido (~1ms)');
  console.log('  Old Space  : objetos longevos, Major GC lento (~100ms+)');
  console.log('  Map leak   : referencias fuertes — limpiar por TTL/LRU');
  console.log('  WeakMap    : referencias débiles — GC libera cuando no hay otras refs');
  console.log('  .once()    : listener que se auto-elimina');
  console.log('  .off()     : siempre removeListener cuando termines con un handler');
}

main().catch(console.error);
