/**
 * worker-pool.ts — Worker Pool: reutilizar workers para múltiples tareas
 *
 * Objetivo: crear un pool de workers persistentes que procesa una cola
 * de tareas, evitando el overhead de crear/destruir un worker por tarea.
 * Muestra la diferencia de throughput entre pool vs worker-por-tarea.
 */
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from 'worker_threads';
import * as crypto from 'node:crypto';
import * as os from 'node:os';

if (isMainThread) {
  runMain();
} else {
  runWorker();
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkerPool: mantiene N workers activos y una cola de tareas pendientes
// ─────────────────────────────────────────────────────────────────────────────
interface Task<T = unknown> {
  data:    unknown;
  resolve: (value: T) => void;
  reject:  (err: Error) => void;
}

class WorkerPool {
  private workers:   Worker[]  = [];
  private freeSlots: Worker[]  = [];
  private queue:     Task[]    = [];

  constructor(size: number, filename: string) {
    const script = `
      require('ts-node').register({ transpileOnly: true });
      require(${JSON.stringify(filename)});
    `;
    for (let i = 0; i < size; i++) {
      const worker = new Worker(script, { eval: true });
      this.workers.push(worker);
      this.freeSlots.push(worker);
    }
  }

  run<T>(data: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const freeWorker = this.freeSlots.shift();
      if (freeWorker) {
        this._dispatch<T>(freeWorker, data, resolve, reject);
      } else {
        // Todos ocupados → encolar
        this.queue.push({ data, resolve: resolve as any, reject });
      }
    });
  }

  private _dispatch<T>(
    worker:  Worker,
    data:    unknown,
    resolve: (value: T) => void,
    reject:  (err: Error) => void,
  ): void {
    worker.once('message', (result: unknown) => {
      resolve(result as T);
      // Worker libre → procesar siguiente de la cola, o devolver al pool
      const next = this.queue.shift();
      if (next) {
        this._dispatch(worker, next.data, next.resolve as any, next.reject);
      } else {
        this.freeSlots.push(worker);
      }
    });
    worker.once('error', (err: Error) => {
      reject(err);
      this.freeSlots.push(worker);
    });
    worker.postMessage(data);
  }

  async terminate(): Promise<void> {
    await Promise.all(this.workers.map(w => w.terminate()));
    this.workers   = [];
    this.freeSlots = [];
  }

  get queueLength(): number { return this.queue.length; }
  get poolSize():    number { return this.workers.length; }
}

// ─────────────────────────────────────────────────────────────────────────────
// HILO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
async function runMain(): Promise<void> {
  console.log('========================================');
  console.log(' Worker Pool — Intermediate             ');
  console.log('========================================\n');

  await demo1PoolVsPerTask();
  await demo2PoolWithQueue();
  await demo3OptimalPoolSize();

  console.log('========================================');
  console.log(' Resumen                                ');
  console.log('========================================');
  console.log('  Pool         : workers reutilizables → evita overhead de spawn');
  console.log('  Queue        : tareas que exceden el pool esperan en cola');
  console.log('  Tamaño óptimo: os.cpus().length — uno por núcleo lógico');
  console.log('  Regla        : pool > cores → context switching contraproducente');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 1: Worker por tarea vs Pool — overhead de spawn
// ─────────────────────────────────────────────────────────────────────────────
async function demo1PoolVsPerTask(): Promise<void> {
  console.log('─── DEMO 1: Worker-por-tarea vs Pool — overhead de creación ───');

  const TASKS   = 8;
  const payload = { iterations: 200_000 };

  // ── Sin pool: crea y destruye un worker por tarea
  const startPerTask = Date.now();
  await Promise.all(
    Array.from({ length: TASKS }, () => runInNewWorker(payload))
  );
  const perTaskTime = Date.now() - startPerTask;

  // ── Con pool: workers ya están vivos, se reutilizan
  const CORES    = Math.min(os.cpus().length, 4);
  const pool     = new WorkerPool(CORES, __filename);
  const startPool = Date.now();
  await Promise.all(
    Array.from({ length: TASKS }, () => pool.run<number>(payload))
  );
  const poolTime = Date.now() - startPool;

  pool.terminate();

  console.log(`  ${TASKS} tareas (${CORES} workers en pool):`);
  console.log(`  Worker-por-tarea : ${perTaskTime}ms  (spawn + work + terminate × ${TASKS})`);
  console.log(`  Pool             : ${poolTime}ms   (solo work × ${TASKS})`);
  console.log(`  Ahorro overhead  : ~${perTaskTime - poolTime}ms`);
  console.log('  ✅ Con pool: el overhead de spawn se paga solo una vez\n');
}

// Helper: crear un worker desechable para un payload
function runInNewWorker(data: unknown): Promise<number> {
  return new Promise((resolve, reject) => {
    const script = `
      require('ts-node').register({ transpileOnly: true });
      require(${JSON.stringify(__filename)});
    `;
    const w = new Worker(script, { eval: true, workerData: data });
    w.on('message', resolve);
    w.on('error',   reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 2: Pool con cola — más tareas que workers disponibles
// ─────────────────────────────────────────────────────────────────────────────
async function demo2PoolWithQueue(): Promise<void> {
  console.log('─── DEMO 2: Pool con cola — 10 tareas, 2 workers ───');

  const POOL_SIZE = 2;
  const TOTAL     = 10;
  const pool      = new WorkerPool(POOL_SIZE, __filename);

  const results: number[] = [];
  const times:   number[] = [];

  const promises = Array.from({ length: TOTAL }, (_, i) => {
    const start = Date.now();
    return pool.run<number>({ iterations: 100_000 }).then(result => {
      times.push(Date.now() - start);
      results.push(result as number);
      process.stdout.write(`  ✓ Tarea ${String(i + 1).padStart(2)} completada en ${times[times.length - 1]}ms\n`);
    });
  });

  await Promise.all(promises);
  pool.terminate();

  const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(0);
  const max = Math.max(...times);
  console.log(`\n  ${TOTAL} tareas con pool de ${POOL_SIZE}:`);
  console.log(`  Avg por tarea : ${avg}ms`);
  console.log(`  Máx por tarea : ${max}ms  ← tareas que esperaron en cola`);
  console.log('  ✅ Las primeras 2 tareas van directo; el resto espera en cola\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 3: Tamaño óptimo del pool
// ─────────────────────────────────────────────────────────────────────────────
async function demo3OptimalPoolSize(): Promise<void> {
  console.log('─── DEMO 3: Tamaño óptimo del pool ───');

  const TASKS   = 8;
  const CORES   = os.cpus().length;
  const payload = { iterations: 300_000 };
  const sizes   = [1, 2, Math.min(CORES, 4), Math.min(CORES * 2, 8)];

  for (const size of sizes) {
    const pool  = new WorkerPool(size, __filename);
    const start = Date.now();
    await Promise.all(Array.from({ length: TASKS }, () => pool.run<number>(payload)));
    const elapsed = Date.now() - start;
    pool.terminate();

    const marker = size === Math.min(CORES, 4) ? ' ← óptimo' : '';
    console.log(`  Pool size ${size.toString().padStart(2)}: ${String(elapsed).padStart(5)}ms${marker}`);
  }

  console.log(`\n  Núcleos disponibles: ${CORES}`);
  console.log('  📌 Regla: pool = os.cpus().length para CPU-bound');
  console.log('            pool = cpus × 2 para I/O-bound (puede esperar)\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// HILO WORKER — recibe tareas vía postMessage, responde con resultado
// ─────────────────────────────────────────────────────────────────────────────
function runWorker(): void {
  // Si fue creado con workerData directo (demo 1 helper), ejecuta una vez
  if (workerData && workerData.iterations) {
    const result = heavyCompute(workerData.iterations);
    parentPort!.postMessage(result);
    return;
  }

  // Si viene del pool, espera mensajes continuos
  parentPort!.on('message', (data: { iterations: number }) => {
    const result = heavyCompute(data.iterations);
    parentPort!.postMessage(result);
  });
}

// Trabajo CPU-bound simulado: suma de hashes
function heavyCompute(iterations: number): number {
  let sum = 0;
  for (let i = 0; i < iterations; i++) {
    sum += crypto.createHash('md5').update(String(i)).digest().readUInt32BE(0);
  }
  return sum;
}
