/**
 * 01 - EVENT LOOP
 *
 * Sistema de Conciliación Bancaria que procesa miles de transacciones.
 *
 * CONCEPTOS A EXPLICAR EN CÓDIGO:
 *
 * - Call Stack
 * - Web APIs / libuv delegation
 * - Timer Queue
 * - Microtask Queue
 * - Orden real de ejecución
 */

console.log("1️⃣ Inicio del Proceso de Conciliación Bancaria (Sync) \n");

/*
 * Simulamos la  consulta al banco (I/O externo)
 * Node delega esta operación a LIBUV (no bloquea el hilo principal)
 */
setTimeout(() => {
  console.log("5️⃣ Consulta al Banco: Transacciones Obtenidas (setTimeout) \n");
}, 0);

/*
 * Simulamos la validación asincrónica inmediata de las transacciones (Microtask)
 * Promise entra en la Microtask Queue, que tiene prioridad sobre la Timer Queue
 */
Promise.resolve().then(() => {
  console.log("3️⃣ Validación de Transacciones: Completada (Promise) \n");

  // Experimento adicional: Anidamos un nextTick()
  process.nextTick(() => {
    console.log("🧪 nextTick programado desde Promise \n");
  });
});

// Microtask Queue
queueMicrotask(() => {
  console.log("🧪 Microtask explícita con queueMicrotask \n");
});

/*
 * Simulamos la generación de un reporte (Tarea sincrónica) después del I/O
 * Esta tarea bloquea el hilo principal hasta su finalización
 * Aunque el setTimeout tiene un delay de 0ms, la generación del reporte se ejecutará antes debido a la naturaleza sincrónica del código y la prioridad de la Microtask Queue sobre la Timer Queue.
 */
setImmediate(() => {
  console.log("6️⃣ Reporte de inconsistencias generado (setImmediate) \n");
});

/*
 * Simulamos una tarea de preparación del entorno (Microtask)
 * Esta tarea se ejecutará antes que el setTimeout debido a la prioridad de la Microtask Queue sobre la Timer Queue.
 */
process.nextTick(() => {
  console.log("2️⃣ Preparación interna antes de continuar (nextTick) \n");
});

console.log("4️⃣ Esperando respuesta del banco...(Sync) \n");
