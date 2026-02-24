/**
 * transform-streams.ts — Transform streams, Object Mode y pipelines encadenados
 *
 * Objetivo: construir Transform streams personalizados, encadenar múltiples
 * transforms en un pipeline, y trabajar con Object Mode para flujos de objetos JS.
 */
import { Readable, Writable, Transform, pipeline } from 'node:stream';
import { promisify } from 'node:util';

const pipelineAsync = promisify(pipeline);

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 1: Custom Transform — parsear CSV en tiempo real
//
// Un Transform recibe bytes (chunks), los procesa, y emite otra cosa.
// Aquí convertimos líneas CSV en strings formateados.
// ─────────────────────────────────────────────────────────────────────────────
class CsvParserTransform extends Transform {
  private buffer: string = '';
  private lineCount: number = 0;

  constructor() {
    super({ readableObjectMode: false, writableObjectMode: false });
  }

  _transform(chunk: Buffer, _encoding: string, callback: Function): void {
    // Los chunks no respetan límites de línea: acumulamos en buffer
    this.buffer += chunk.toString();
    const lines = this.buffer.split('\n');

    // La última "línea" puede estar incompleta; la guardamos para el próximo chunk
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      this.lineCount++;
      const [name, score, city] = line.split(',').map(s => s.trim());
      const formatted = `  [línea ${this.lineCount}] ${name} | puntaje: ${score} | ciudad: ${city}\n`;
      this.push(formatted);
    }

    callback();
  }

  _flush(callback: Function): void {
    // Procesar cualquier resto en el buffer al terminar el stream
    if (this.buffer.trim()) {
      this.lineCount++;
      const [name, score, city] = this.buffer.split(',').map(s => s.trim());
      this.push(`  [línea ${this.lineCount}] ${name} | puntaje: ${score} | ciudad: ${city}\n`);
    }
    callback();
  }
}

async function demo1CsvTransform(): Promise<void> {
  console.log('─── DEMO 1: Custom Transform — CSV parser en tiempo real ───');

  const csvData = [
    'nombre,puntaje,ciudad\n',
    'Alice,95,Madrid\nBob,87,Bar',   // chunk cortado a propósito
    'celona\nCarlos,92,Sev',         // sigue el chunk anterior
    'illa\nDiana,78,Valencia\n',
  ];

  const source    = Readable.from(csvData);
  const csvParser = new CsvParserTransform();
  const printer   = new Writable({
    write(chunk: Buffer, _enc: string, cb: Function) {
      process.stdout.write(chunk.toString());
      cb();
    },
  });

  console.log('  Chunks de entrada (CSV sin separación de líneas):');
  csvData.forEach((c, i) => console.log(`  [chunk ${i}]: "${c.replace(/\n/g, '\\n')}"`));
  console.log('\n  Salida del Transform:');

  await pipelineAsync(source, csvParser, printer);
  console.log('  ✅ CsvParserTransform ensamblado correctamente líneas de múltiples chunks\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 2: Pipeline con múltiples Transform encadenados
//
// Cada Transform hace una sola cosa (Single Responsibility):
//   Readable → FilterEmptyLines → ToUpperCase → AddTimestamp → Writable
// ─────────────────────────────────────────────────────────────────────────────
class FilterEmptyLines extends Transform {
  _transform(chunk: Buffer, _enc: string, cb: Function): void {
    const line = chunk.toString().trim();
    if (line) this.push(chunk);   // solo emite si la línea no está vacía
    cb();
  }
}

class ToUpperCase extends Transform {
  _transform(chunk: Buffer, _enc: string, cb: Function): void {
    this.push(chunk.toString().toUpperCase());
    cb();
  }
}

class AddTimestamp extends Transform {
  _transform(chunk: Buffer, _enc: string, cb: Function): void {
    const ts = new Date().toISOString().slice(11, 23);  // HH:MM:SS.mmm
    this.push(`[${ts}] ${chunk.toString()}`);
    cb();
  }
}

async function demo2MultipleTransforms(): Promise<void> {
  console.log('─── DEMO 2: Pipeline con múltiples Transforms encadenados ───');

  const lines = [
    'primera línea importante\n',
    '\n',                              // línea vacía → FilterEmptyLines la elimina
    'segunda línea con datos\n',
    '   \n',                           // sólo espacios → también filtrada
    'tercera línea final\n',
  ];

  const source    = Readable.from(lines);
  const filter    = new FilterEmptyLines();
  const upper     = new ToUpperCase();
  const timestamp = new AddTimestamp();
  const output    = new Writable({
    write(chunk: Buffer, _enc: string, cb: Function) {
      process.stdout.write(`  OUT: ${chunk}`);
      cb();
    },
  });

  console.log('  Entrada (5 líneas, 2 vacías):');
  console.log('    Readable → FilterEmptyLines → ToUpperCase → AddTimestamp → Writable\n');

  await pipelineAsync(source, filter, upper, timestamp, output);
  console.log('\n  ✅ Cada Transform hizo una sola responsabilidad\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 3: Object Mode — streams de objetos JavaScript
//
// Por defecto los streams trabajan con Buffers/strings.
// objectMode: true permite emitir objetos JS arbitrarios.
// Muy útil para pipelines de procesamiento de datos estructurados.
// ─────────────────────────────────────────────────────────────────────────────
interface UserRecord {
  id:    number;
  name:  string;
  score: number;
}

interface EnrichedRecord extends UserRecord {
  grade:   string;
  passing: boolean;
}

async function demo3ObjectMode(): Promise<void> {
  console.log('─── DEMO 3: Object Mode — pipeline de objetos JS ───');

  const users: UserRecord[] = [
    { id: 1, name: 'Alice',  score: 95 },
    { id: 2, name: 'Bob',    score: 42 },
    { id: 3, name: 'Carlos', score: 78 },
    { id: 4, name: 'Diana',  score: 61 },
    { id: 5, name: 'Eve',    score: 33 },
  ];

  // Readable en object mode: emite objetos UserRecord
  const userSource = Readable.from(users, { objectMode: true });

  // Transform: enriquece el objeto con grado y estado (sin convertir a string)
  const enricher = new Transform({
    objectMode: true,
    transform(user: UserRecord, _enc: string, cb: Function) {
      const grade   = user.score >= 90 ? 'A' : user.score >= 70 ? 'B' : user.score >= 50 ? 'C' : 'F';
      const passing = user.score >= 50;
      const enriched: EnrichedRecord = { ...user, grade, passing };
      this.push(enriched);
      cb();
    },
  });

  // Transform: filtra solo los que aprueban
  const passFilter = new Transform({
    objectMode: true,
    transform(record: EnrichedRecord, _enc: string, cb: Function) {
      if (record.passing) this.push(record);   // sólo aprobados
      cb();
    },
  });

  // Writable: imprime el resultado final
  let count = 0;
  const reporter = new Writable({
    objectMode: true,
    write(record: EnrichedRecord, _enc: string, cb: Function) {
      count++;
      console.log(`  ✅ ${record.name.padEnd(8)} | score: ${record.score} | grade: ${record.grade}`);
      cb();
    },
  });

  console.log('  Pipeline: [UserRecord] → Enrich → Filter(passing) → Print');
  console.log('  Entrada: 5 usuarios  |  Esperados aprobados: 3\n');

  await pipelineAsync(userSource, enricher, passFilter, reporter);

  console.log(`\n  Aprobados impresos: ${count}`);
  console.log('  ✅ Object mode: sin serializar/deserializar, objetos fluyen directamente\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 4: Custom Readable con _read() — control total de la producción
//
// Implementing _read() te da control total de cuándo y qué datos produces.
// Útil para: websockets, polling de APIs, generadores infinitos con límite.
// ─────────────────────────────────────────────────────────────────────────────
class CountdownReadable extends Readable {
  private current: number;
  private readonly step: number;

  constructor(start: number, step: number = 1) {
    super({ objectMode: false });
    this.current = start;
    this.step    = step;
  }

  _read(): void {
    if (this.current <= 0) {
      this.push('¡Lanzamiento! 🚀\n');
      this.push(null);          // null = fin del stream
      return;
    }
    this.push(`${this.current}...\n`);
    this.current -= this.step;
  }
}

async function demo4CustomReadable(): Promise<void> {
  console.log('─── DEMO 4: Custom Readable con _read() ───');

  const countdown = new CountdownReadable(5);
  const output    = new Writable({
    write(chunk: Buffer, _enc: string, cb: Function) {
      process.stdout.write(`  ${chunk}`);
      cb();
    },
  });

  console.log('  CountdownReadable(5) — cada _read() baja un número:');
  await pipelineAsync(countdown, output);
  console.log('\n  ✅ _read() se llamó hasta que push(null) señaló el fin\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('========================================');
  console.log(' Transform Streams — Advanced           ');
  console.log('========================================\n');

  await demo1CsvTransform();
  await demo2MultipleTransforms();
  await demo3ObjectMode();
  await demo4CustomReadable();

  console.log('========================================');
  console.log(' Resumen                                ');
  console.log('========================================');
  console.log('  Transform._transform() : procesa cada chunk y emite con this.push()');
  console.log('  Transform._flush()     : procesa datos residuales al terminar el stream');
  console.log('  objectMode: true       : permite objetos JS en lugar de Buffers');
  console.log('  Readable._read()       : control total sobre cuándo producir datos');
  console.log('  pipeline multi-stage   : cada Transform → una responsabilidad');
}

main().catch(console.error);
