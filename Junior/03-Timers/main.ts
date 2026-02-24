/**
 * 03 - TIMERS Y PRECISIÓN
 *
 * Vamos a medir la desviación real
 * de setTimeout en Node.
 */

const delay = 1000;

const start = Date.now();

setTimeout(() => {
  const end = Date.now();
  console.log(`Esperado: ${delay}ms`);
  console.log(`Real: ${end - start}ms`);
}, delay);