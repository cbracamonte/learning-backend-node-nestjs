/**
 * main.ts — Demo básico de Streams y Pipeline
 *
 * Muestra el patrón fundamental: Readable → Transform → Writable
 * gestionado con pipeline() para evitar memory leaks y manejar errores.
 */
import { Readable, Writable, Transform, pipeline } from 'node:stream';
import { promisify } from 'node:util';

const pipelineAsync = promisify(pipeline);

console.log('=== 05 - Streams & Backpressure ===\n');

// ── 1. Readable: fuente de datos (array de strings como iterable)
const words = ['Streams ', 'son ', 'datos ', 'que ', 'fluyen ', 'en ', 'chunks.\n'];
const source = Readable.from(words);

// ── 2. Transform: modifica los datos en vuelo (sin cargar todo en memoria)
const upperCase = new Transform({
  transform(chunk: Buffer, _encoding: string, callback: Function) {
    // Simula procesamiento: convierte cada chunk a mayúsculas
    callback(null, chunk.toString().toUpperCase());
  },
});

// ── 3. Writable: consume los datos del Transform
const printer = new Writable({
  write(chunk: Buffer, _encoding: string, callback: Function) {
    process.stdout.write(`  [chunk] → ${chunk}`);
    callback();
  },
});

// ── pipeline() encadena todo y garantiza:
//    - cierre automático de todos los streams si uno falla
//    - propagación de errores
//    - sin memory leaks por streams sin consumir
pipelineAsync(source, upperCase, printer)
  .then(() => {
    console.log('\n✅ Pipeline completado: Readable → Transform → Writable');
    console.log('   pipeline() cerró todos los streams automáticamente.');
    console.log('\n💡 Ejecuta los niveles para ver casos prácticos:');
    console.log('   npm run start:beginner   → readFile vs createReadStream');
    console.log('   npm run start:intermediate → backpressure y pause/resume');
    console.log('   npm run start:advanced    → Transform streams y object mode');
  })
  .catch((err: Error) => {
    console.error('❌ Error en el pipeline:', err.message);
  });
