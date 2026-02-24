/**
 * BEGINNER — Prioridad de ejecución: Microtasks vs Macrotasks
 *
 * Objetivo:
 *   Visualizar el orden exacto en que Node.js ejecuta cada tipo de tarea.
 *
 * Regla fundamental:
 *   Sync → process.nextTick → Promise.then / queueMicrotask → setTimeout → setImmediate
 */

console.log('1️⃣  [SYNC]    Inicio del script\n');

// ─── MACROTASK: Timer Queue (fase 1) ─────────────────────────────────────────
setTimeout(() => {
  console.log('6️⃣  [MACRO]   setTimeout  →  Timer Queue (fase 1)\n');
}, 0);

// ─── MACROTASK: Check Queue (fase 5) ─────────────────────────────────────────
setImmediate(() => {
  console.log('7️⃣  [MACRO]   setImmediate  →  Check Queue (fase 5)\n');
});

// ─── MICROTASK: Promise.then ──────────────────────────────────────────────────
Promise.resolve().then(() => {
  console.log('4️⃣  [MICRO]   Promise.then  →  Microtask Queue\n');
});

// ─── MICROTASK ESPECIAL: nextTick (mayor prioridad) ──────────────────────────
process.nextTick(() => {
  console.log('3️⃣  [NEXT]    process.nextTick  →  NextTick Queue (antes de microtasks)\n');
});

// ─── MICROTASK: queueMicrotask ────────────────────────────────────────────────
queueMicrotask(() => {
  console.log('5️⃣  [MICRO]   queueMicrotask  →  Microtask Queue\n');
});

console.log('2️⃣  [SYNC]    Fin del script principal\n');

/**
 * Salida esperada:
 *
 *  1️⃣  [SYNC]    Inicio del script
 *  2️⃣  [SYNC]    Fin del script principal
 *  3️⃣  [NEXT]    process.nextTick  →  NextTick Queue
 *  4️⃣  [MICRO]   Promise.then  →  Microtask Queue
 *  5️⃣  [MICRO]   queueMicrotask  →  Microtask Queue
 *  6️⃣ / 7️⃣  [MACRO]  setTimeout y setImmediate  ← orden NO determinístico en top-level
 *
 * ⚠️  setTimeout(0) vs setImmediate en el top-level del script:
 *   El orden entre ambos es NO garantizado porque depende de cuándo
 *   el sistema de timers del SO registra el timer de 0ms.
 *   Dentro de un callback de I/O, setImmediate SIEMPRE gana.
 *
 * Orden garantizado: Sync → nextTick → Microtasks → (Timers y Check, orden variable)
 */
