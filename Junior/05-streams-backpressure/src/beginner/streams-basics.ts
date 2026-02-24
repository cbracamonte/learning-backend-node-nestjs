/**
 * streams-basics.ts — I/O con y sin Streams
 *
 * Objetivo: entender por qué cargar archivos grandes con readFile es peligroso
 * y cómo createReadStream procesa los datos chunk por chunk sin llenar la RAM.
 */
import * as fs   from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';

const README_PATH = path.join(__dirname, '../../README.md');

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 1: fs.readFile — carga TODO el archivo en memoria de una sola vez
// ─────────────────────────────────────────────────────────────────────────────
function demo1ReadFile(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('─── DEMO 1: fs.readFile (todo en memoria) ───');
    const before = process.memoryUsage().heapUsed;

    fs.readFile(README_PATH, 'utf-8', (err, data) => {
      if (err) return reject(err);

      const after  = process.memoryUsage().heapUsed;
      const delta  = ((after - before) / 1024).toFixed(1);
      const lines  = data.split('\n').length;

      console.log(`  Archivo leído completo: ${data.length} bytes, ${lines} líneas`);
      console.log(`  Heap usado extra: ~${delta} KB`);
      console.log('  ⚠️  Para un archivo de 2 GB → todo entra en el heap → posible OOM\n');
      resolve();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 2: fs.createReadStream — lee chunk a chunk
// highWaterMark controla el tamaño máximo de cada chunk (en bytes)
// ─────────────────────────────────────────────────────────────────────────────
function demo2CreateReadStream(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('─── DEMO 2: fs.createReadStream (chunk por chunk) ───');

    // highWaterMark = 64 bytes para ver muchos chunks pequeños
    const stream = fs.createReadStream(README_PATH, {
      highWaterMark: 64,
      encoding: 'utf-8',
    });

    let chunkCount   = 0;
    let totalBytes   = 0;
    let firstChunk   = '';

    stream.on('data', (chunk: string) => {
      chunkCount++;
      totalBytes += chunk.length;
      if (chunkCount === 1) firstChunk = chunk.slice(0, 30).replace(/\n/g, '\\n');
    });

    stream.on('end', () => {
      console.log(`  Total chunks recibidos : ${chunkCount}`);
      console.log(`  Total bytes procesados : ${totalBytes}`);
      console.log(`  Primer chunk (30 chars): "${firstChunk}..."`);
      console.log(`  ✅ En ningún momento se cargó el archivo completo en memoria\n`);
      resolve();
    });

    stream.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 3: Readable.from() — crear un Readable desde cualquier iterable/generador
// Útil para tests, pipelines de datos en memoria, y generadores infinitos.
// ─────────────────────────────────────────────────────────────────────────────
function demo3ReadableFrom(): Promise<void> {
  return new Promise((resolve) => {
    console.log('─── DEMO 3: Readable.from() — iterable como stream ───');

    // Generador que produce líneas de log "infinitas" (cortamos manualmente)
    function* logGenerator() {
      for (let i = 1; i <= 5; i++) {
        yield `[LOG ${i}] Evento procesado en ${Date.now()}ms\n`;
      }
    }

    const stream = Readable.from(logGenerator());
    let received = 0;

    stream.on('data', (chunk: Buffer) => {
      received++;
      process.stdout.write(`  ${chunk.toString()}`);
    });

    stream.on('end', () => {
      console.log(`  ✅ ${received} líneas emitidas desde un generador (sin archivo)\n`);
      resolve();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 4: Los 4 tipos de streams en Node.js
// ─────────────────────────────────────────────────────────────────────────────
function demo4StreamTypes(): void {
  console.log('─── DEMO 4: Los 4 tipos de Streams ───');
  console.log('');
  console.log('  Readable  → Solo se puede leer de él');
  console.log('             Ejemplo: fs.createReadStream, http.IncomingMessage');
  console.log('');
  console.log('  Writable  → Solo se puede escribir en él');
  console.log('             Ejemplo: fs.createWriteStream, http.ServerResponse');
  console.log('');
  console.log('  Duplex    → Se puede leer Y escribir (buffers independientes)');
  console.log('             Ejemplo: net.Socket (TCP socket)');
  console.log('');
  console.log('  Transform → Duplex que transforma: lo que entra ≠ lo que sale');
  console.log('             Ejemplo: zlib.createGzip, crypto.createCipher');
  console.log('');

  // Mapa de herencia:
  console.log('  Jerarquía:');
  console.log('  Stream (EventEmitter)');
  console.log('  ├─ Readable');
  console.log('  ├─ Writable');
  console.log('  └─ Duplex');
  console.log('     └─ Transform');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('========================================');
  console.log(' Streams Basics — Beginner              ');
  console.log('========================================\n');

  await demo1ReadFile();
  await demo2CreateReadStream();
  await demo3ReadableFrom();
  demo4StreamTypes();

  console.log('========================================');
  console.log(' Resumen                                ');
  console.log('========================================');
  console.log('  readFile     → Buffer completo en RAM (peligroso con archivos grandes)');
  console.log('  readStream   → chunk a chunk, highWaterMark controla el tamaño');
  console.log('  Readable.from → convierte cualquier iterable en stream');
  console.log('  Los 4 tipos  → Readable, Writable, Duplex, Transform');
}

main().catch(console.error);
