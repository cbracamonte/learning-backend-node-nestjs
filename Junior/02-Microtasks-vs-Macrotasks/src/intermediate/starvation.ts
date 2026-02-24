/**
 * INTERMEDIATE — Starvation: cuando las Microtasks bloquean el Event Loop
 *
 * Objetivo:
 *   Demostrar que generar microtasks infinitas impide que las macrotasks
 *   (setTimeout, setImmediate) se ejecuten alguna vez.
 *
 *   Esto se llama STARVATION y puede romper tu backend silenciosamente.
 */

console.log("🚀 Inicio\n");

// ─── MACROTASK: nunca llegará si hay starvation ───────────────────────────────
setTimeout(() => {
  console.log("✅ setTimeout ejecutado — el loop NO sufrió starvation\n");
}, 0);

// ─── Demostración segura: microtask encadenada (sin starvation) ───────────────
let counter = 0;
const MAX_ITERATIONS = 5;

function safeMicrotaskChain(): void {
  if (counter >= MAX_ITERATIONS) {
    console.log(
      `✅ Cadena de ${MAX_ITERATIONS} microtasks completada — cediendo control al loop\n`,
    );
    return;
  }

  counter++;
  console.log(
    `  🔄 [MICRO] Iteración ${counter}/${MAX_ITERATIONS} — Promise encadenada`,
  );

  // Cada Promise.then encola la siguiente microtask; el loop NO avanza
  // hasta que se vacíe la cadena completa.
  Promise.resolve().then(safeMicrotaskChain);
}

safeMicrotaskChain();

// ─── Demostración de starvation real (COMENTADA a propósito) ─────────────────

// ⚠️  NO descomentar en producción — esto bloquea el proceso indefinidamente.

// function infiniteStarvation(): void {
//   process.nextTick(infiniteStarvation); // <- nunca cede el control
// }
// infiniteStarvation();

// setTimeout(() => {
//   console.log("Este mensaje NUNCA aparecerá");
// }, 0);

console.log("📌 Script principal terminado — ahora drenarán las microtasks\n");

/**
 * Salida esperada:
 *
 *  🚀 Inicio
 *  📌 Script principal terminado — ahora drenarán las microtasks
 *  🔄 [MICRO] Iteración 1/5 — Promise encadenada
 *  🔄 [MICRO] Iteración 2/5 — Promise encadenada
 *  🔄 [MICRO] Iteración 3/5 — Promise encadenada
 *  🔄 [MICRO] Iteración 4/5 — Promise encadenada
 *  🔄 [MICRO] Iteración 5/5 — Promise encadenada
 *  ✅ Cadena de 5 microtasks completada — cediendo control al loop
 *  ✅ setTimeout ejecutado — el loop NO sufrió starvation
 *
 * Lección:
 *   Cada Promise que se encola DENTRO de otra microtask sigue siendo
 *   una microtask, así que el Event Loop NO puede avanzar de fase hasta
 *   que se agote la cadena. Si esa cadena es infinita → STARVATION.
 */
