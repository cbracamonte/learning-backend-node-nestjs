/**
 * INTERMEDIATE — Thread Pool de Libuv: tamaño y saturación
 *
 * Objetivo:
 *   Demostrar que Libuv tiene un Thread Pool de 4 hilos por defecto.
 *   Las operaciones CPU-bound (crypto, zlib, fs en algunos SO) comparten
 *   esos hilos. Si lanzas más tareas que hilos disponibles, las extras
 *   esperan en cola → latencia visible.
 *
 * Conceptos:
 *   - UV_THREADPOOL_SIZE: variable de entorno para cambiar el tamaño (máx 1024)
 *   - pbkdf2: operación CPU-bound que SIEMPRE usa el thread pool
 *   - Saturación: cuando todas las tareas tardan el doble (5ta tarea espera)
 *   - I/O de red (TCP/UDP): usa el SO directamente, NO usa thread pool
 */

import { pbkdf2 } from 'node:crypto';

const ITERATIONS = 100_000; // cuánto trabajo hace cada tarea
const TASKS      = 5;       // más que los 4 hilos del pool por defecto

console.log(`🚀 Lanzando ${TASKS} tareas pbkdf2 (thread pool size = ${process.env.UV_THREADPOOL_SIZE ?? '4 por defecto'})\n`);
console.log('   Las primeras 4 arrancan inmediatamente.');
console.log('   La tarea 5 debe esperar a que un hilo quede libre.\n');

const globalStart = Date.now();

for (let i = 1; i <= TASKS; i++) {
  const taskStart = Date.now();

  pbkdf2('password', `salt-${i}`, ITERATIONS, 64, 'sha512', () => {
    const elapsed = Date.now() - taskStart;
    const total   = Date.now() - globalStart;
    const slot    = total > elapsed * 1.5 ? '⏳ esperó en cola' : '⚡ corrió inmediato';
    console.log(`  ✅ Task ${i} terminada | duración: ${elapsed}ms | total: ${total}ms | ${slot}`);
  });
}

// Este código sigue corriendo mientras el thread pool trabaja
console.log('📌 [SYNC] El hilo JS continúa libre — el thread pool trabaja en background\n');

/**
 * Cómo experimentar con UV_THREADPOOL_SIZE:
 *
 *   UV_THREADPOOL_SIZE=1 npx ts-node src/intermediate/io-threads.ts
 *   → todas las tareas corren en serie (1 hilo), tiempos 5x mayores
 *
 *   UV_THREADPOOL_SIZE=5 npx ts-node src/intermediate/io-threads.ts
 *   → las 5 tareas corren en paralelo, todas terminan al mismo tiempo
 *
 * Salida esperada (pool=4 por defecto):
 *
 *  📌 [SYNC] El hilo JS continúa libre
 *
 *  ✅ Task 1 terminada | duración: ~300ms | total: ~300ms | ⚡ corrió inmediato
 *  ✅ Task 2 terminada | duración: ~300ms | total: ~300ms | ⚡ corrió inmediato
 *  ✅ Task 3 terminada | duración: ~300ms | total: ~300ms | ⚡ corrió inmediato
 *  ✅ Task 4 terminada | duración: ~300ms | total: ~300ms | ⚡ corrió inmediato
 *  ✅ Task 5 terminada | duración: ~300ms | total: ~600ms | ⏳ esperó en cola
 *
 * Lecciones clave:
 *  - Las tareas 1-4 terminan juntas porque hay 4 hilos disponibles.
 *  - La tarea 5 tarda el doble en total porque esperó a que un hilo quedara libre.
 *  - El hilo JS (Event Loop) nunca se bloqueó: el log SYNC apareció antes que todo.
 *  - UV_THREADPOOL_SIZE controla cuántas operaciones CPU-bound corren en paralelo.
 */
