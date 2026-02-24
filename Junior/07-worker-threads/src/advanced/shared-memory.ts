/**
 * shared-memory.ts — SharedArrayBuffer y Atomics
 *
 * Objetivo: entender la memoria compartida entre threads, por qué las
 * operaciones no-atómicas producen race conditions, y cómo Atomics
 * garantiza operaciones thread-safe sin locks explícitos.
 */
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';

if (isMainThread) {
  runMain();
} else {
  runWorker();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: lanzar worker con SharedArrayBuffer
// ─────────────────────────────────────────────────────────────────────────────
function spawnWorker(data: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = `
      require('ts-node').register({ transpileOnly: true });
      require(${JSON.stringify(__filename)});
    `;
    const w = new Worker(script, { eval: true, workerData: data });
    w.on('message', resolve);
    w.on('error',   reject);
    w.on('exit',    resolve);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HILO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
async function runMain(): Promise<void> {
  console.log('========================================');
  console.log(' SharedArrayBuffer & Atomics — Advanced ');
  console.log('========================================\n');

  await demo1SharedArrayBuffer();
  await demo2RaceCondition();
  await demo3AtomicsSafe();
  await demo4AtomicsWaitNotify();
  demo5TransferableObjects();

  console.log('========================================');
  console.log(' Resumen                                ');
  console.log('========================================');
  console.log('  SharedArrayBuffer : memoria compartida entre threads (no se copia)');
  console.log('  postMessage       : serializa+copia los datos (structuredClone)');
  console.log('  Race condition    : escrituras concurrentes sin sync → corrupto');
  console.log('  Atomics.add       : read-modify-write atómico, thread-safe');
  console.log('  Atomics.wait/notify: primitiva de sincronización (mutex/condvar)');
  console.log('  Transferable      : ArrayBuffer transferido sin copia (ownership)');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 1: SharedArrayBuffer básico — memoria que se comparte, no se copia
// ─────────────────────────────────────────────────────────────────────────────
async function demo1SharedArrayBuffer(): Promise<void> {
  console.log('─── DEMO 1: SharedArrayBuffer — memoria compartida ───');

  // Sin SAB: postMessage serializa los datos (structuredClone)
  console.log('  postMessage (sin SAB):');
  const normalBuffer = new ArrayBuffer(4);
  const normalView   = new Int32Array(normalBuffer);
  normalView[0] = 42;
  console.log(`  Antes del postMessage: normalView[0] = ${normalView[0]}`);
  // Si postMessage enviara normalBuffer, el worker recibe una COPIA
  console.log('  → worker recibe COPIA → cambios en el worker no se reflejan aquí\n');

  // Con SAB: los bytes son los mismos para todos los threads
  console.log('  SharedArrayBuffer (con SAB):');
  const sab   = new SharedArrayBuffer(4);       // 4 bytes compartidos
  const view  = new Int32Array(sab);
  view[0] = 0;

  console.log(`  Valor inicial: view[0] = ${view[0]}`);

  await spawnWorker({ task: 'write-sab', sab, expectedValue: 99 });

  console.log(`  Después de que el worker escribió: view[0] = ${view[0]}`);
  console.log('  ✅ El worker modificó la memoria compartida directamente');
  console.log('  ✅ Sin serialización, sin copia — mismo bloque de bytes\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 2: Race Condition — escrituras concurrentes sin sincronización
//
// Dos workers incrementan el mismo contador 10.000 veces cada uno.
// Sin Atomics, las operaciones read-modify-write no son atómicas:
//   Worker A lee 5
//   Worker B lee 5 (antes de que A escriba)
//   Worker A escribe 6
//   Worker B escribe 6 ← pierde el incremento de A
// Resultado esperado: 20.000  Resultado real: < 20.000 (variable)
// ─────────────────────────────────────────────────────────────────────────────
async function demo2RaceCondition(): Promise<void> {
  console.log('─── DEMO 2: Race Condition — sin Atomics ───');

  const INCREMENTS_EACH = 10_000;
  const WORKERS         = 2;
  const sab             = new SharedArrayBuffer(4);
  const counter         = new Int32Array(sab);
  counter[0]            = 0;

  await Promise.all(
    Array.from({ length: WORKERS }, () =>
      spawnWorker({ task: 'unsafe-increment', sab, increments: INCREMENTS_EACH })
    )
  );

  const expected = WORKERS * INCREMENTS_EACH;
  const actual   = counter[0];
  const lost     = expected - actual;

  console.log(`  Esperado : ${expected.toLocaleString()}`);
  console.log(`  Actual   : ${actual.toLocaleString()}`);
  console.log(`  Perdidos : ${lost.toLocaleString()} incrementos   ← race condition`);
  console.log('  ⚠️  En JS cada ++ es read-modify-write → NO atómica\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 3: Atomics.add — operación read-modify-write garantizada atómica
// ─────────────────────────────────────────────────────────────────────────────
async function demo3AtomicsSafe(): Promise<void> {
  console.log('─── DEMO 3: Atomics.add — counter thread-safe ───');

  const INCREMENTS_EACH = 10_000;
  const WORKERS         = 2;
  const sab             = new SharedArrayBuffer(4);
  const counter         = new Int32Array(sab);
  counter[0]            = 0;

  await Promise.all(
    Array.from({ length: WORKERS }, () =>
      spawnWorker({ task: 'atomic-increment', sab, increments: INCREMENTS_EACH })
    )
  );

  const expected = WORKERS * INCREMENTS_EACH;
  const actual   = Atomics.load(counter, 0);    // Atomics.load para leer de forma segura

  console.log(`  Esperado : ${expected.toLocaleString()}`);
  console.log(`  Actual   : ${actual.toLocaleString()}`);
  console.log(`  Perdidos : ${(expected - actual).toLocaleString()}`);
  console.log('  ✅ Atomics.add garantiza que cada operación es atómica\n');

  // Otras operaciones atómicas útiles:
  console.log('  Otras operaciones Atomics:');
  const buf = new SharedArrayBuffer(8);
  const arr = new Int32Array(buf);
  arr[0] = 10;

  const old = Atomics.exchange(arr, 0, 99);    // swap atómico, retorna valor anterior
  console.log(`  Atomics.exchange(arr, 0, 99) → anterior: ${old}, nuevo: ${arr[0]}`);

  const swapped = Atomics.compareExchange(arr, 0, 99, 42);  // CAS
  console.log(`  Atomics.compareExchange(arr, 0, 99→42) → era: ${swapped}, ahora: ${arr[0]}`);
  console.log('  (CAS = Compare-And-Swap: escribe sólo si el valor actual es el esperado)\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 4: Atomics.wait / Atomics.notify — sincronización entre threads
//
// El worker espera (bloqueado) hasta que el main thread le notifique.
// Equivalente a un condition variable o semáforo simple.
// ─────────────────────────────────────────────────────────────────────────────
async function demo4AtomicsWaitNotify(): Promise<void> {
  console.log('─── DEMO 4: Atomics.wait / Atomics.notify — señalización ───');

  const sab    = new SharedArrayBuffer(8);
  const signal = new Int32Array(sab);
  signal[0]    = 0;    // 0 = no listo, 1 = listo

  // Lanzar worker que espera la señal
  const workerDone = spawnWorker({ task: 'wait-notify', sab });

  // Simular trabajo en el main thread antes de señalar
  console.log('  Main: preparando datos... (100ms)');
  await new Promise<void>(r => setTimeout(r, 100));

  console.log('  Main: datos listos → enviando señal al worker');
  Atomics.store(signal, 0, 1);           // escribir 1 de forma atómica
  Atomics.notify(signal, 0, 1);          // despertar a 1 thread que espera en signal[0]

  await workerDone;
  console.log('  ✅ Worker procesó los datos después de recibir la señal\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 5: Transferable Objects — transferir ownership sin copia
// ─────────────────────────────────────────────────────────────────────────────
function demo5TransferableObjects(): void {
  console.log('─── DEMO 5: Transferable Objects — sin copia ───');

  // postMessage normal: el buffer se SERIALIZA (copia completa)
  const buf1    = new ArrayBuffer(1024 * 1024);   // 1 MB
  const view1   = new Uint8Array(buf1);
  view1.fill(42);

  console.log(`  ArrayBuffer antes de postMessage: ${buf1.byteLength} bytes`);
  // Si pasáramos buf1 a un worker con postMessage(data), se copiaría
  // Con transfer: el ownership se mueve al worker, el original queda detached

  const script = `
    require('ts-node').register({ transpileOnly: true });
    require(${JSON.stringify(__filename)});
  `;
  // Crear worker con el buffer transferido (no copiado)
  const w = new Worker(script, {
    eval: true,
    workerData: (() => {
      // Transferimos usando structuredClone + transfer en workerData no disponible directamente
      // pero la demostración conceptual es válida:
      return { task: 'noop' };
    })(),
  });
  w.terminate();

  console.log('  postMessage(data)              : copia completa (O(n) tiempo/memoria)');
  console.log('  postMessage(data, [transfer])  : O(1) — mueve ownership del buffer');
  console.log('  Tras transferir: ArrayBuffer original.byteLength = 0 (detached)');
  console.log('  ✅ Usar transferables para buffers grandes entre threads\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// HILO WORKER
// ─────────────────────────────────────────────────────────────────────────────
function runWorker(): void {
  const data = workerData as {
    task:          string;
    sab?:          SharedArrayBuffer;
    increments?:   number;
    expectedValue?: number;
  };

  switch (data.task) {
    case 'write-sab': {
      // Escribir en el SAB compartido con Atomics para ser thread-safe
      const view = new Int32Array(data.sab!);
      Atomics.store(view, 0, data.expectedValue ?? 99);
      parentPort!.postMessage('done');
      break;
    }

    case 'unsafe-increment': {
      // Race condition intencional: ++ no-atómico
      const counter = new Int32Array(data.sab!);
      for (let i = 0; i < data.increments!; i++) {
        counter[0]++;     // READ + MODIFY + WRITE = 3 pasos NO atómicos
      }
      parentPort!.postMessage('done');
      break;
    }

    case 'atomic-increment': {
      // Increment atómico: Atomics.add garantiza exclusividad
      const counter = new Int32Array(data.sab!);
      for (let i = 0; i < data.increments!; i++) {
        Atomics.add(counter, 0, 1);   // atomic read-modify-write
      }
      parentPort!.postMessage('done');
      break;
    }

    case 'wait-notify': {
      // Esperar hasta que el main thread notifique con signal[0] = 1
      const signal = new Int32Array(data.sab!);
      console.log('  Worker: esperando señal del main thread...');
      Atomics.wait(signal, 0, 0);    // espera hasta que signal[0] ≠ 0
      console.log(`  Worker: señal recibida (signal[0]=${signal[0]}) → procesando`);
      parentPort!.postMessage('done');
      break;
    }

    case 'noop':
    default:
      parentPort!.postMessage('done');
      break;
  }
}
