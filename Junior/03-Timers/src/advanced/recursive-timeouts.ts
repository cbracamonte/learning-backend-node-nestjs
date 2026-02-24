/**
 * ADVANCED — setTimeout recursivo, cancelación en cadena y timer pool
 *
 * Objetivo:
 *   Implementar un scheduler de tareas que gestiona múltiples timers,
 *   puede cancelarlos por prioridad y mide el drift real acumulado.
 *   Patrón habitual en servidores de retry, polling y rate limiting.
 *
 * Conceptos avanzados:
 *   - setTimeout recursivo como alternativa precisa a setInterval
 *   - Map<string, NodeJS.Timeout> como pool de timers cancelables
 *   - Drift tracking: medir y corregir desviación acumulada
 *   - Graceful shutdown: cancelar todos los timers activos al salir
 */

interface ScheduledTask {
  id:          string;
  intervalMs:  number;
  maxRuns:     number;
  runs:        number;
  totalDrift:  number;
  lastRun:     number;
  handle:      ReturnType<typeof setTimeout> | null;
}

// Pool global de timers activos
const timerPool = new Map<string, ScheduledTask>();

// ─── Registrar una tarea en el pool ──────────────────────────────────────────
function schedule(id: string, intervalMs: number, maxRuns: number): void {
  const task: ScheduledTask = {
    id,
    intervalMs,
    maxRuns,
    runs:       0,
    totalDrift: 0,
    lastRun:    Date.now(),
    handle:     null,
  };

  timerPool.set(id, task);

  function tick(): void {
    const task = timerPool.get(id);
    if (!task) return; // fue cancelada

    task.runs++;
    const now   = Date.now();
    const drift = (now - task.lastRun) - task.intervalMs;
    task.totalDrift += Math.abs(drift);
    task.lastRun = now;

    const sign = drift >= 0 ? '+' : '';
    console.log(
      `  ⏱  [${id}]  run ${task.runs}/${task.maxRuns}  drift: ${sign}${drift}ms  ` +
      `acumulado: ${task.totalDrift}ms`
    );

    if (task.runs >= task.maxRuns) {
      cancel(id);
      checkDone();
      return;
    }

    // Auto-ajuste: descuenta el drift del próximo delay
    const nextMs = Math.max(0, task.intervalMs - drift);
    task.handle  = setTimeout(tick, nextMs);
  }

  task.handle = setTimeout(tick, intervalMs);
  console.log(`📋 Tarea registrada: [${id}]  cada ${intervalMs}ms  ×${maxRuns} runs\n`);
}

// ─── Cancelar una tarea por id ────────────────────────────────────────────────
function cancel(id: string): void {
  const task = timerPool.get(id);
  if (!task) return;
  if (task.handle) clearTimeout(task.handle);
  timerPool.delete(id);
  console.log(`🛑 Tarea cancelada: [${id}]\n`);
}

// ─── Graceful shutdown: cancela todo ─────────────────────────────────────────
function shutdownAll(): void {
  console.log('\n⏹  shutdownAll() — cancelando todos los timers activos...');
  for (const id of timerPool.keys()) {
    cancel(id);
  }
  console.log('✅ Todos los timers cancelados\n');
}

// ─── Verificar si todas las tareas terminaron ─────────────────────────────────
function checkDone(): void {
  if (timerPool.size === 0) {
    console.log('\n' + '─'.repeat(60));
    console.log('🏁 Todas las tareas completadas\n');
  }
}

// ─── Inicio ───────────────────────────────────────────────────────────────────
console.log('🚀 Timer Pool Scheduler arrancando...\n');

// Tres tareas con distintos intervalos
schedule('fast',   50,  6);   // cada 50ms,  6 veces
schedule('medium', 120, 4);   // cada 120ms, 4 veces
schedule('slow',   200, 2);   // cada 200ms, 2 veces

// Cancelar 'slow' después de 250ms para demostrar cancelación externa
setTimeout(() => {
  if (timerPool.has('slow')) {
    console.log('\n⚡ Cancelación externa de [slow] a los 250ms\n');
    cancel('slow');
    checkDone();
  }
}, 250);

/**
 * Salida esperada (los drifts varían según la carga del sistema):
 *
 *  🚀 Timer Pool Scheduler arrancando...
 *  📋 Tarea registrada: [fast]   cada 50ms  ×6 runs
 *  📋 Tarea registrada: [medium] cada 120ms ×4 runs
 *  📋 Tarea registrada: [slow]   cada 200ms ×2 runs
 *
 *  ⏱  [fast]   run 1/6   drift: +1ms   acumulado: 1ms
 *  ⏱  [fast]   run 2/6   drift: +0ms   acumulado: 1ms
 *  ⏱  [medium] run 1/4   drift: +1ms   acumulado: 1ms
 *  ⏱  [fast]   run 3/6   ...
 *  ⚡ Cancelación externa de [slow] a los 250ms
 *  🛑 Tarea cancelada: [slow]
 *  ... (fast y medium continúan)
 *  🏁 Todas las tareas completadas
 *
 * Lecciones clave:
 *  - Un Map<id, handle> es el patrón estándar para gestionar timers cancelables.
 *  - setTimeout recursivo con auto-ajuste es más preciso que setInterval.
 *  - shutdownAll() es obligatorio en servidores para evitar procesos zombie.
 *  - El drift real depende de la carga del Event Loop, no de tu código.
 */
