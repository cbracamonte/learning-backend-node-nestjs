/**
 * ADVANCED — Mezcla compleja: I/O real + nextTick anidado + Promises + Timers
 *
 * Objetivo:
 *   Predecir el orden de ejecución cuando conviven I/O real (fs), nextTick
 *   programado desde una callback de I/O, y macrotasks.
 *
 * Este patrón aparece en servidores reales que leen configuración,
 * validan datos y responden en el mismo tick.
 */

import fs from "node:fs";
import path from "node:path";
// __dirname es una global nativa en CommonJS — no se necesita fileURLToPath

console.log("1️⃣  [SYNC]    Script arranca\n");

// ─── MACROTASK — Timer Queue ──────────────────────────────────────────────────
setTimeout(() => {
  console.log("8️⃣  [MACRO]   setTimeout 0ms\n");

  // nextTick desde dentro de un macrotask: se ejecuta ANTES de la
  // siguiente macrotask pero DESPUÉS de que este callback termine.
  process.nextTick(() => {
    console.log("9️⃣  [NEXT]    nextTick encolado desde setTimeout\n");
  });
}, 0);

// ─── MACROTASK — Check Queue ──────────────────────────────────────────────────
setImmediate(() => {
  console.log("🔟 [MACRO]   setImmediate\n");
});

// ─── MICROTASK ESPECIAL — nextTick (mayor prioridad que Promise) ─────────────
// Aunque Promise.resolve() esté escrito antes en el código, la NextTick Queue
// siempre se drena ANTES que la Microtask Queue — sin importar el orden de registro.
process.nextTick(() => {
  console.log("3️⃣  [NEXT]    nextTick del script principal\n");

  // nextTick anidado: se encola al frente de la NextTick Queue,
  // antes incluso de que se procese la Microtask Queue.
  process.nextTick(() => {
    console.log(
      "   ↳ [NEXT]   nextTick anidado (cola antes que Promise.then)\n",
    );
  });
});

// ─── MICROTASK — Promise resuelta inmediatamente ─────────────────────────────
// Se registra DESPUÉS de nextTick pero se ejecuta DESPUÉS también:
// la Microtask Queue tiene menor prioridad que la NextTick Queue.
Promise.resolve()
  .then(() => {
    console.log("4️⃣  [MICRO]   Primera Promise.then\n");
    return "resultado";
  })
  .then((val) => {
    console.log(
      `5️⃣  [MICRO]   Segunda Promise.then encadenada — valor: "${val}"\n`,
    );
  });

// ─── I/O REAL — Poll Queue ────────────────────────────────────────────────────
// Lee el propio archivo; cuando termina, su callback entra en Poll Queue (fase 4).
fs.readFile(path.resolve(__dirname), "utf8", (_err, _data) => {
  console.log("6️⃣  [I/O]     fs.readFile completado — Poll Queue (fase 4)\n");

  // nextTick desde I/O: se drena ANTES de que el loop avance a Check (fase 5).
  process.nextTick(() => {
    console.log("7️⃣  [NEXT]    nextTick encolado desde el callback de I/O\n");
  });

  setImmediate(() => {
    console.log(
      "   ↳ [MACRO]  setImmediate encolado desde I/O — se ejecuta después de nextTick\n",
    );
  });
});

console.log("2️⃣  [SYNC]    Fin del script principal\n");

/**
 * Salida esperada (el orden 6-7 puede variar ligeramente según el S.O.
 * y cuánto tarda el readFile, pero el patrón de prioridades es siempre igual):
 *
 *  1️⃣  [SYNC]    Script arranca
 *  2️⃣  [SYNC]    Fin del script principal
 *  3️⃣  [NEXT]    nextTick del script principal
 *     ↳ [NEXT]   nextTick anidado
 *  4️⃣  [MICRO]   Primera Promise.then
 *  5️⃣  [MICRO]   Segunda Promise.then encadenada
 *  8️⃣  [MACRO]   setTimeout 0ms
 *  9️⃣  [NEXT]    nextTick encolado desde setTimeout
 *  🔟  [MACRO]   setImmediate (script principal)
 *  6️⃣  [I/O]     fs.readFile completado
 *  7️⃣  [NEXT]    nextTick encolado desde I/O
 *     ↳ [MACRO]  setImmediate encolado desde I/O
 *
 * Lecciones clave:
 *  - nextTick anidado se ejecuta DENTRO de la misma "pasada" de NextTick Queue.
 *  - nextTick encolado desde un macrotask se ejecuta ANTES de la siguiente fase.
 *  - I/O real entra por Poll; su setImmediate irá al Check del MISMO ciclo.
 *  - El orden de setTimeout vs setImmediate en el script principal puede variar,
 *    pero si están dentro de un callback de I/O, setImmediate siempre gana.
 */
