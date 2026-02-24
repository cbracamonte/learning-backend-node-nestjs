/**
 * 02 - MICROTASKS VS MACROTASKS
 *
 * Este archivo demuestra:
 *
 * - Prioridad real de ejecución
 * - Diferencia entre Promise, setTimeout, setImmediate
 * - Cómo process.nextTick tiene prioridad especial
 * - Qué es starvation
 */

console.log('1️⃣ Inicio conciliación bancaria (Sync) \n');

/**
 * MACROTASK - Timers phase
 */
setTimeout(() => {
  console.log('6️⃣ setTimeout ejecutado (MACROTASK) \n');
}, 0);

/**
 * MACROTASK - Check phase
 */
setImmediate(() => {
  console.log('7️⃣ setImmediate ejecutado (MACROTASK) \n');
});

/**
 * MICROTASK - Promise
 */
Promise.resolve().then(() => {
  console.log('4️⃣ Promise microtask ejecutada (MICROTASK) \n');
});

/**
 * MICROTASK ESPECIAL - nextTick
 * Tiene prioridad incluso sobre Promise
 */
process.nextTick(() => {
  console.log('2️⃣ nextTick ejecutado (MICROTASK ESPECIAL) \n');
});

/**
 * Microtask encadenada
 */
Promise.resolve().then(() => {
  console.log('5️⃣ Segunda microtask Promise (MICROTASK) \n');
});

console.log('3️⃣ Fin del script principal (Sync) \n');