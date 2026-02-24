/**
 * BEGINNER — setTimeout y setImmediate: precisión y orden real
 *
 * Objetivo:
 *   Entender que setTimeout(fn, 0) NO significa "ahora", sino
 *   "elegible en la fase Timers". Medir la desviación real de cada timer.
 *
 * Conceptos:
 *   - setTimeout(fn, delay): encola fn en Timer Queue tras >= delay ms
 *   - setImmediate(fn):      encola fn en Check Queue (fase 5)
 *   - clearTimeout / clearImmediate: cancelan un timer antes de que dispare
 */

console.log('1️⃣  [SYNC]  Script arranca\n');

// ─── setTimeout con delay 0 ───────────────────────────────────────────────────
// 0ms no significa "inmediato"; significa "tan pronto como la fase Timers llegue".
// La desviación real suele ser 1-3ms por overhead del sistema operativo.
const t0start = Date.now();
const timer1 = setTimeout(() => {
  const elapsed = Date.now() - t0start;
  console.log(`4️⃣  [TIMER]  setTimeout(0ms)   → ejecutado a los ${elapsed}ms reales\n`);
}, 0);

// ─── setTimeout con delay 50ms ────────────────────────────────────────────────
const t50start = Date.now();
setTimeout(() => {
  const elapsed = Date.now() - t50start;
  console.log(`6️⃣  [TIMER]  setTimeout(50ms)  → ejecutado a los ${elapsed}ms reales\n`);
}, 50);

// ─── setImmediate ─────────────────────────────────────────────────────────────
// No tiene delay. Corre en la fase Check (fase 5), DESPUÉS de Poll (I/O).
// En top-level puede salir antes O después de setTimeout(0) — no determinístico.
setImmediate(() => {
  console.log('5️⃣  [CHECK]  setImmediate → Check Queue (fase 5)\n');
});

// ─── clearTimeout ─────────────────────────────────────────────────────────────
// Cancelar un timer antes de que dispare.
const timerCancelado = setTimeout(() => {
  console.log('❌  Este mensaje NUNCA debería aparecer\n');
}, 20);
clearTimeout(timerCancelado);
console.log('2️⃣  [SYNC]  timerCancelado limpiado con clearTimeout\n');

console.log('3️⃣  [SYNC]  Fin del script principal\n');

/**
 * Salida esperada (setTimeout(0) y setImmediate pueden intercambiarse en top-level):
 *
 *  1️⃣  [SYNC]  Script arranca
 *  2️⃣  [SYNC]  timerCancelado limpiado con clearTimeout
 *  3️⃣  [SYNC]  Fin del script principal
 *  4️⃣/5️⃣  [TIMER/CHECK]  setTimeout(0ms) y setImmediate  ← orden NO determinístico en top-level
 *  6️⃣  [TIMER] setTimeout(50ms)  → ejecutado a los ~50ms reales
 *
 * Lecciones clave:
 *  - setTimeout(fn, 0) tiene un mínimo real de ~1ms por el sistema operativo.
 *  - setImmediate no tiene delay: corre en Check, después de Poll.
 *  - clearTimeout cancela sin error aunque el timer ya haya disparado.
 *  - La desviación (drift) crece si el hilo principal está ocupado.
 */
