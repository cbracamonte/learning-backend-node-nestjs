/**
 * main.ts — Demo básico de Worker Threads
 *
 * Problema: Node.js es single-threaded para JS. Una tarea CPU-bound
 * (fibonacci, cifrado, compresión) bloquea el Event Loop entero.
 * Solución: delegar la tarea a un Worker Thread — hilo dedicado con
 * su propio V8 y su propio Event Loop.
 */
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as crypto from 'node:crypto';

// ── Patrón isMainThread: el mismo archivo actúa como main Y como worker
if (isMainThread) {
  mainThread();
} else {
  workerThread();
}

// ─────────────────────────────────────────────────────────────────────────────
// HILO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
function mainThread(): void {
  console.log('=== 07 - Worker Threads ===\n');

  const transactions = Array.from({ length: 500 }, (_, i) => ({
    id: i,
    from: `wallet-${i}`,
    to:   `wallet-${i + 1}`,
    amount: Math.random() * 1000,
  }));

  console.log(`Tarea: hashear ${transactions.length} transacciones con SHA-512`);
  console.log('Delegando al Worker Thread...\n');

  const start = Date.now();

  // Crear el Worker pasando el mismo archivo + workerData
  // ts-node no registra automáticamente en el worker; usamos eval para cargarlo
  const workerScript = `
    require('ts-node').register({ transpileOnly: true });
    require(${JSON.stringify(__filename)});
  `;

  const worker = new Worker(workerScript, {
    eval: true,
    workerData: { transactions },
  });

  // El Event Loop sigue corriendo mientras el worker trabaja
  const ticker = setInterval(() => {
    process.stdout.write('  [Event Loop libre] tick\n');
  }, 5);

  worker.on('message', (results: Array<{ id: number; hash: string }>) => {
    clearInterval(ticker);
    const elapsed = Date.now() - start;
    console.log(`\n✅ Worker completó ${results.length} hashes en ${elapsed}ms`);
    console.log(`   Primer hash: ${results[0].hash.slice(0, 32)}...`);
    console.log('\n💡 Ejecuta los niveles:');
    console.log('   npm run start:beginner     → Event Loop bloqueado vs libre');
    console.log('   npm run start:intermediate → Worker Pool para tareas concurrentes');
    console.log('   npm run start:advanced     → SharedArrayBuffer + Atomics');
  });

  worker.on('error', (err) => {
    clearInterval(ticker);
    console.error('Worker error:', err);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HILO WORKER
// ─────────────────────────────────────────────────────────────────────────────
function workerThread(): void {
  const { transactions } = workerData as { transactions: Array<Record<string, unknown>> };

  const results = transactions.map(tx => ({
    ...tx,
    hash: crypto.createHash('sha512').update(JSON.stringify(tx)).digest('hex'),
  }));

  parentPort!.postMessage(results);
}
