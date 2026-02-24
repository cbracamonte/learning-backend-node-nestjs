/**
 * backpressure.ts — Backpressure: el problema y las soluciones
 *
 * Objetivo: ver en práctica qué ocurre cuando un productor es más rápido que
 * un consumidor, cómo `write()` señala backpressure, y por qué `pipeline()`
 * es siempre mejor que `.pipe()` en producción.
 */
import { Readable, Writable, pipeline } from 'node:stream';
import { promisify } from 'node:util';

const pipelineAsync = promisify(pipeline);

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 1: write() devuelve false — señal de backpressure
//
// La API de Writable devuelve `false` en `.write()` cuando su buffer interno
// supera highWaterMark. Esto le indica al productor que debe pausarse.
// ─────────────────────────────────────────────────────────────────────────────
function demo1BackpressureSignal(): Promise<void> {
  return new Promise((resolve) => {
    console.log('─── DEMO 1: write() → false = backpressure activo ───');

    // Writable lento: simula 20ms de trabajo por chunk (e.g. base de datos)
    const slowWriter = new Writable({
      highWaterMark: 2,    // buffer interno: máx 2 chunks antes de señalar presión
      write(chunk: Buffer, _enc: string, callback: Function) {
        setTimeout(() => {            // simula latencia del consumidor
          process.stdout.write(`  ✍  Chunk procesado: "${chunk.toString().trim()}"\n`);
          callback();                 // señala que está listo para el siguiente
        }, 20);
      },
    });

    const chunks = ['alpha\n', 'beta\n', 'gamma\n', 'delta\n', 'epsilon\n'];
    let backpressureCount = 0;

    chunks.forEach((chunk) => {
      const canContinue = slowWriter.write(chunk);
      if (!canContinue) {
        backpressureCount++;
        process.stdout.write(`  ⚠️  Backpressure en chunk "${chunk.trim()}" — buffer lleno\n`);
      }
    });

    slowWriter.end(() => {
      console.log(`\n  Veces que se activó backpressure: ${backpressureCount}`);
      console.log('  ✅ Todos los chunks escritos (pero el productor ignoró la señal)\n');
      resolve();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 2: pause() / resume() — responder correctamente al backpressure
//
// El patrón correcto es: si write() devuelve false → pausar el Readable.
// Cuando el Writable dispara 'drain' → reanudar el Readable.
// ─────────────────────────────────────────────────────────────────────────────
function demo2PauseResume(): Promise<void> {
  return new Promise((resolve) => {
    console.log('─── DEMO 2: pause() / resume() — respuesta correcta ───');

    // Productor rápido: 8 chunks de golpe
    const fastProducer = Readable.from(
      Array.from({ length: 8 }, (_, i) => `item-${i + 1}\n`)
    );

    // Consumidor lento: 15ms por chunk
    let consumed = 0;
    const slowConsumer = new Writable({
      highWaterMark: 2,
      write(chunk: Buffer, _enc: string, callback: Function) {
        setTimeout(() => {
          consumed++;
          process.stdout.write(`  ✍  Consumido: ${chunk.toString().trim()} (total: ${consumed})\n`);
          callback();
        }, 15);
      },
    });

    let pauseCount   = 0;
    let drainCount   = 0;

    // Conectar manualmente y manejar backpressure
    fastProducer.on('data', (chunk: Buffer) => {
      const ok = slowConsumer.write(chunk);
      if (!ok) {
        pauseCount++;
        fastProducer.pause();    // ← detiene la producción de chunks
        process.stdout.write(`  ⏸  Readable pausado (pausa #${pauseCount})\n`);
      }
    });

    slowConsumer.on('drain', () => {
      drainCount++;
      process.stdout.write(`  ▶️  Drain evento #${drainCount} — Readable reanudado\n`);
      fastProducer.resume();   // ← el buffer se vació, reanuda la producción
    });

    fastProducer.on('end', () => slowConsumer.end());

    slowConsumer.on('finish', () => {
      console.log(`\n  Chunks consumidos    : ${consumed}`);
      console.log(`  Veces que se pausó   : ${pauseCount}`);
      console.log(`  Eventos drain        : ${drainCount}`);
      console.log('  ✅ Backpressure manejado correctamente con pause/resume\n');
      resolve();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 3: .pipe() vs pipeline() — manejo de errores
//
// .pipe() NO maneja errores: si el Readable falla, el Writable no se cierra.
// pipeline() propaga errores y hace cleanup de todos los streams involucrados.
// ─────────────────────────────────────────────────────────────────────────────
async function demo3PipeVsPipeline(): Promise<void> {
  console.log('─── DEMO 3: .pipe() vs pipeline() — errores ───');

  // ── .pipe() sin manejo de errores (patrón problemático)
  console.log('\n  [.pipe()] — sin error handling:');
  await new Promise<void>((resolve) => {
    const source = Readable.from(['dato-1\n', 'dato-2\n']);
    const dest   = new Writable({
      write(chunk: Buffer, _enc: string, cb: Function) {
        process.stdout.write(`  ↪ pipe recibió: ${chunk.toString().trim()}\n`);
        cb();
      },
    });

    // Si source emitiera un 'error', dest NO se cerraría automáticamente
    source.pipe(dest);
    dest.on('finish', () => {
      console.log('  ⚠️  .pipe() funcionó, pero si source falla → dest queda abierto');
      resolve();
    });
  });

  // ── pipeline() con error handling (patrón correcto)
  console.log('\n  [pipeline()] — con error handling y cleanup:');
  const source2 = Readable.from(['dato-A\n', 'dato-B\n', 'dato-C\n']);
  const dest2   = new Writable({
    write(chunk: Buffer, _enc: string, cb: Function) {
      process.stdout.write(`  ↪ pipeline recibió: ${chunk.toString().trim()}\n`);
      cb();
    },
  });

  try {
    await pipelineAsync(source2, dest2);
    console.log('  ✅ pipeline() completado — todos los streams cerrados correctamente');
    console.log('  ✅ Si hubiera fallado, dest2 se habría cerrado automáticamente');
  } catch (err: unknown) {
    console.error('  ❌ Error en pipeline:', (err as Error).message);
  }

  // ── Simular error y ver que pipeline limpia
  console.log('\n  [pipeline() con error simulado]:');
  const broken = new Readable({
    read() {
      this.push('línea válida\n');
      this.destroy(new Error('Error de red simulado'));  // falla intencionalmente
    },
  });

  const dest3 = new Writable({
    write(chunk: Buffer, _enc: string, cb: Function) {
      process.stdout.write(`  ↪ Recibido antes del error: ${chunk.toString().trim()}\n`);
      cb();
    },
  });

  try {
    await pipelineAsync(broken, dest3);
  } catch (err: unknown) {
    console.log(`  ✅ Error capturado correctamente: "${(err as Error).message}"`);
    console.log('  ✅ dest3 fue cerrado por pipeline() automáticamente\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('========================================');
  console.log(' Backpressure — Intermediate            ');
  console.log('========================================\n');

  await demo1BackpressureSignal();
  await demo2PauseResume();
  await demo3PipeVsPipeline();

  console.log('========================================');
  console.log(' Resumen                                ');
  console.log('========================================');
  console.log('  write() → false   : el buffer interno superó highWaterMark');
  console.log('  pause() / resume(): respuesta manual al backpressure');
  console.log('  drain event       : el buffer se vació, podemos producir más');
  console.log('  .pipe()           : conveniente pero sin manejo de errores');
  console.log('  pipeline()        : siempre en producción — limpia y propaga errores');
}

main().catch(console.error);
