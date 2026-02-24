/**
 * INTERMEDIATE — setInterval, drift acumulado y clearInterval
 *
 * Objetivo:
 *   Demostrar que setInterval NO garantiza intervalos exactos.
 *   El intervalo mide "tiempo desde que el callback terminó de registrarse",
 *   no "tiempo desde que el callback anterior terminó de ejecutarse".
 *   Si el callback tarda, el drift se acumula tick a tick.
 *
 * Conceptos:
 *   - setInterval(fn, ms):  repite fn cada >= ms en Timer Queue
 *   - clearInterval(id):    detiene el interval
 *   - Drift acumulado:      desfase que crece si el callback tarda
 *   - Self-correcting timer: patrón setTimeout recursivo que corrige el drift
 */

const INTERVAL_MS = 100;
const MAX_TICKS   = 5;
let   tickCount   = 0;
let   lastTick    = Date.now();

console.log('🚀 Iniciando interval de ~100ms (5 ticks)\n');

// ─── setInterval básico ───────────────────────────────────────────────────────
// Cada tick puede llegar tarde si el Event Loop estaba ocupado.
const interval = setInterval(() => {
  tickCount++;
  const now     = Date.now();
  const elapsed = now - lastTick;
  lastTick      = now;

  console.log(`  🔁 Tick ${tickCount}/${MAX_TICKS}  →  ${elapsed}ms desde el tick anterior`);

  // Simulamos trabajo dentro del callback (bloqueo de 20ms).
  // Esto NO retrasa el SIGUIENTE tick porque setInterval mide desde
  // que fue registrado, no desde que el callback terminó.
  const busyUntil = Date.now() + 20;
  while (Date.now() < busyUntil) { /* CPU busy */ }

  if (tickCount >= MAX_TICKS) {
    clearInterval(interval);
    console.log('\n✅ Interval detenido con clearInterval\n');
    showDriftLesson();
  }
}, INTERVAL_MS);

// ─── Demostración del patrón self-correcting timer ───────────────────────────
function showDriftLesson(): void {
  console.log('─'.repeat(55));
  console.log('PATRÓN CORRECTO: setTimeout recursivo auto-ajustado\n');

  const TARGET_MS    = 100;
  let   selfTickCount = 0;
  let   selfStart     = Date.now();

  function selfCorrectingTimer(): void {
    selfTickCount++;
    const now     = Date.now();
    const elapsed = now - selfStart;
    selfStart     = now;

    console.log(`  🎯 SelfTick ${selfTickCount}/3  →  ${elapsed}ms (se auto-ajusta)`);

    // El próximo timeout descuenta el tiempo que tardó este callback.
    const drift   = elapsed - TARGET_MS;
    const nextMs  = Math.max(0, TARGET_MS - drift);

    if (selfTickCount < 3) {
      setTimeout(selfCorrectingTimer, nextMs);
    } else {
      console.log('\n✅ Self-correcting timer completado\n');
    }
  }

  setTimeout(selfCorrectingTimer, TARGET_MS);
}

/**
 * Salida esperada:
 *
 *  🚀 Iniciando interval de ~100ms (5 ticks)
 *    🔁 Tick 1/5  →  ~100ms
 *    🔁 Tick 2/5  →  ~100ms   ← puede ser ~101ms por el trabajo de 20ms
 *    🔁 Tick 3/5  →  ~100ms
 *    🔁 Tick 4/5  →  ~100ms
 *    🔁 Tick 5/5  →  ~100ms
 *  ✅ Interval detenido con clearInterval
 *  ── Self-correcting timer ──
 *    🎯 SelfTick 1/3  →  ~100ms
 *    🎯 SelfTick 2/3  →  ~100ms
 *    🎯 SelfTick 3/3  →  ~100ms
 *
 * Lecciones clave:
 *  - setInterval mide desde el momento del registro, no desde que el callback termina.
 *  - Si el callback tarda más que el interval, los ticks se "acumulan" o se saltean.
 *  - El patrón setTimeout recursivo permite corregir el drift en cada iteración.
 *  - Para tareas periódicas críticas en precisión, usa el patrón self-correcting.
 */
