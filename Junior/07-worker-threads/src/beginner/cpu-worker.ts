/**
 * cpu-worker.ts — El problema CPU-bound y la solución con Worker Threads
 *
 * Objetivo: ver en práctica por qué una tarea CPU-bound bloquea el Event Loop,
 * cómo un Worker Thread resuelve el problema manteniendo el hilo principal libre,
 * y cómo lanzar múltiples workers en paralelo para tareas independientes.
 */
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

// Patrón estándar: mismo archivo = main O worker según isMainThread
if (isMainThread) {
  runMain();
} else {
  runWorker();
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarea CPU-bound: Fibonacci recursivo O(2^n)
// n=40 → ~100ms de CPU pura, sin I/O, sin await — bloquea el hilo completamente
// ─────────────────────────────────────────────────────────────────────────────
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Función que crea un Worker que ejecuta fibonacci en un hilo separado
function fibInWorker(n: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const script = `
      require('ts-node').register({ transpileOnly: true });
      require(${JSON.stringify(__filename)});
    `;
    const worker = new Worker(script, { eval: true, workerData: { task: 'fibonacci', n } });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HILO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
async function runMain(): Promise<void> {
  console.log('========================================');
  console.log(' CPU Worker — Beginner                  ');
  console.log('========================================\n');

  await demo1Blocking();
  await demo2Worker();
  await demo3ParallelWorkers();

  console.log('========================================');
  console.log(' Resumen                                ');
  console.log('========================================');
  console.log('  Blocking     : fibonacci en main thread → Event Loop congelado');
  console.log('  Worker       : fibonacci en Worker     → Event Loop libre');
  console.log('  Parallel     : N workers al mismo tiempo → usa múltiples cores');
  console.log('  Regla        : cualquier tarea > ~5ms de CPU → delegar a Worker');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 1: Tarea CPU-bound en el hilo principal → Event Loop bloqueado
// ─────────────────────────────────────────────────────────────────────────────
async function demo1Blocking(): Promise<void> {
  console.log('─── DEMO 1: fibonacci(38) en main thread — Event Loop BLOQUEADO ───');

  // Este timer debería dispararse cada 5ms, pero no puede porque el CPU lo bloquea
  let ticks = 0;
  const timer = setInterval(() => { ticks++; }, 5);

  const start = Date.now();
  const result = fibonacci(38);           // bloquea el Call Stack
  const elapsed = Date.now() - start;

  clearInterval(timer);

  console.log(`  fibonacci(38)   = ${result}`);
  console.log(`  Tiempo de CPU   : ${elapsed}ms`);
  console.log(`  Ticks esperados : ~${Math.floor(elapsed / 5)} (cada 5ms)`);
  console.log(`  Ticks reales    : ${ticks}  ← Event Loop estaba bloqueado`);
  console.log('  ⚠️  Durante este tiempo: cero requests HTTP, cero callbacks, cero nada\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 2: Misma tarea delegada a un Worker Thread → Event Loop libre
// ─────────────────────────────────────────────────────────────────────────────
async function demo2Worker(): Promise<void> {
  console.log('─── DEMO 2: fibonacci(38) en Worker Thread — Event Loop LIBRE ───');

  let ticks = 0;
  const timer = setInterval(() => { ticks++; }, 5);

  const start = Date.now();
  const result = await fibInWorker(38);   // Worker en otro hilo; await no bloquea
  const elapsed = Date.now() - start;

  clearInterval(timer);

  console.log(`  fibonacci(38)   = ${result}`);
  console.log(`  Tiempo total    : ${elapsed}ms`);
  console.log(`  Ticks reales    : ${ticks}  ← Event Loop siguió corriendo`);
  console.log('  ✅ El hilo principal respondería requests mientras el worker calcula\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 3: Varios workers en paralelo → usa múltiples núcleos
// ─────────────────────────────────────────────────────────────────────────────
async function demo3ParallelWorkers(): Promise<void> {
  console.log('─── DEMO 3: 4 workers en paralelo — múltiples núcleos ───');

  const N       = 37;      // un poco menor para hacerlo más rápido
  const WORKERS = 4;

  // Serie: uno tras otro
  const startSerial = Date.now();
  for (let i = 0; i < WORKERS; i++) {
    await fibInWorker(N);
  }
  const serialTime = Date.now() - startSerial;

  // Paralelo: todos al mismo tiempo
  const startParallel = Date.now();
  await Promise.all(Array.from({ length: WORKERS }, () => fibInWorker(N)));
  const parallelTime = Date.now() - startParallel;

  console.log(`  fibonacci(${N}) × ${WORKERS} tareas:`);
  console.log(`  Serie    : ${serialTime}ms  (una tras otra)`);
  console.log(`  Paralelo : ${parallelTime}ms  (todas a la vez → ${WORKERS} cores)`);
  console.log(`  Speedup  : ~${(serialTime / parallelTime).toFixed(1)}x`);
  console.log('  ✅ Promise.all con Workers aprovecha todos los núcleos disponibles\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// HILO WORKER
// ─────────────────────────────────────────────────────────────────────────────
function runWorker(): void {
  const { task, n } = workerData as { task: string; n: number };
  if (task === 'fibonacci') {
    parentPort!.postMessage(fibonacci(n));
  }
}
