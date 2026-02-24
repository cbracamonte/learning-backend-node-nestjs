/**
 * ADVANCED — I/O concurrente, Streams y DNS: el loop de Libuv en acción
 *
 * Objetivo:
 *   Demostrar tres patrones avanzados de I/O no bloqueante:
 *
 *   1. Lectura concurrente con Promise.all  → todas las lecturas van al thread
 *      pool en paralelo; el tiempo total ≈ la lectura más lenta, no la suma.
 *
 *   2. Streams con backpressure → para archivos grandes, leer todo de una vez
 *      (readFile) puede saturar la memoria; streams procesa chunk a chunk.
 *
 *   3. DNS lookup → usa el thread pool (getaddrinfo es bloqueante en el SO),
 *      NO usa async del SO. Puede saturar el pool si haces muchos a la vez.
 */

import fs      from 'node:fs';
import dns     from 'node:dns';
import path    from 'node:path';
import { promisify } from 'node:util';

const dnsLookup = promisify(dns.lookup);
const FILE      = path.resolve(__dirname, '../../main.ts');

// ─── DEMO 1: Lecturas concurrentes con Promise.all ────────────────────────────
async function concurrentReads(): Promise<void> {
  console.log('─'.repeat(55));
  console.log('DEMO 1 — Lecturas concurrentes (Promise.all)\n');

  const readAsync = (filePath: string): Promise<number> =>
    new Promise((resolve, reject) =>
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return reject(err);
        resolve(data.length);
      })
    );

  const files = [FILE, FILE, FILE, FILE]; // 4 lecturas del mismo archivo
  const start = Date.now();

  // Todas las lecturas se delegan a Libuv al mismo tiempo.
  // El tiempo total ≈ una sola lectura, no 4 en serie.
  const sizes = await Promise.all(files.map(readAsync));
  const elapsed = Date.now() - start;

  console.log(`  ✅ ${files.length} archivos leídos en paralelo en ${elapsed}ms`);
  console.log(`     Tamaños: ${sizes.join(', ')} bytes`);
  console.log(`     Serie habría tardado ~${elapsed * files.length}ms\n`);
}

// ─── DEMO 2: Stream con conteo de chunks (backpressure visual) ────────────────
function streamRead(): Promise<void> {
  return new Promise((resolve) => {
    console.log('─'.repeat(55));
    console.log('DEMO 2 — Stream de lectura (chunk a chunk)\n');

    const stream     = fs.createReadStream(FILE, { highWaterMark: 64 }); // chunks de 64 bytes
    let   chunkCount = 0;
    let   totalBytes = 0;
    const start      = Date.now();

    stream.on('data', (chunk: Buffer) => {
      chunkCount++;
      totalBytes += chunk.length;
      // En un servidor real aquí procesarías cada chunk sin cargar todo en memoria
    });

    stream.on('end', () => {
      console.log(`  ✅ Stream completado en ${Date.now() - start}ms`);
      console.log(`     ${chunkCount} chunks de 64 bytes → ${totalBytes} bytes totales`);
      console.log(`     Ventaja: memory footprint constante sin importar el tamaño del archivo\n`);
      resolve();
    });

    stream.on('error', (err) => { throw err; });
  });
}

// ─── DEMO 3: DNS lookup — thread pool, no async del SO ───────────────────────
async function dnsDemo(): Promise<void> {
  console.log('─'.repeat(55));
  console.log('DEMO 3 — DNS lookup (usa thread pool de Libuv)\n');

  const hosts   = ['nodejs.org', 'npmjs.com', 'github.com'];
  const start   = Date.now();

  // dns.lookup usa getaddrinfo del SO, que es BLOQUEANTE.
  // Libuv lo envía al thread pool para no bloquear el Event Loop.
  // Si haces 100 lookups con pool=4, tendrás 96 esperando en cola.
  const results = await Promise.all(
    hosts.map(async (host) => {
      const t0     = Date.now();
      const result = await dnsLookup(host);
      return { host, ip: result.address, ms: Date.now() - t0 };
    })
  );

  console.log(`  ✅ ${hosts.length} DNS lookups en paralelo en ${Date.now() - start}ms total`);
  for (const r of results) {
    console.log(`     ${r.host.padEnd(15)} → ${r.ip.padEnd(16)} (${r.ms}ms)`);
  }

  console.log();
  console.log('  ⚠️  Alternativa sin thread pool: dns.resolve() usa async del SO directamente.');
  console.log('      Úsalo cuando hagas muchos lookups simultáneos para no saturar el pool.\n');
}

// ─── Orquestación ─────────────────────────────────────────────────────────────
(async () => {
  console.log('🚀 Libuv I/O — Advanced Demo\n');

  await concurrentReads();
  await streamRead();
  await dnsDemo();

  console.log('─'.repeat(55));
  console.log('🏁 Todas las demos completadas\n');
  console.log('Resumen de qué usa el thread pool vs async del SO:\n');
  console.log('  Thread pool (Libuv):  fs.readFile, fs.writeFile, crypto,');
  console.log('                        zlib, dns.lookup (getaddrinfo)');
  console.log('  Async del SO (epoll/kqueue/IOCP):  TCP, UDP, pipes, TTY');
  console.log('  → La red NO usa el thread pool; el disco SÍ.\n');
})();
