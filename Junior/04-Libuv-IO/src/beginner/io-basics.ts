/**
 * BEGINNER — I/O bloqueante vs no-bloqueante
 *
 * Objetivo:
 *   Demostrar visualmente por qué Node.js delega I/O a Libuv:
 *   el hilo JS nunca se bloquea esperando disco o red.
 *
 * Conceptos:
 *   - fs.readFileSync → BLOQUEANTE: detiene el Call Stack hasta que termina
 *   - fs.readFile     → NO BLOQUEANTE: delega a Libuv y sigue ejecutando
 *   - Poll Queue      → donde llega el callback cuando Libuv termina
 */

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve(__dirname, '../../main.ts'); // archivo pequeño, siempre existe

console.log('─'.repeat(55));
console.log('DEMO 1 — Lectura BLOQUEANTE (readFileSync)\n');

const syncStart = Date.now();

// ⚠️ readFileSync bloquea el hilo JS completamente.
// Mientras espera, NADA más puede ejecutarse.
const content = fs.readFileSync(FILE, 'utf8');
const syncMs  = Date.now() - syncStart;

console.log(`1️⃣  [SYNC]  readFileSync completado en ${syncMs}ms`);
console.log(`            ${content.split('\n').length} líneas leídas`);
console.log(`            ⚠️  El hilo JS estuvo bloqueado ${syncMs}ms\n`);

// Timers registrados ANTES de readFileSync nunca pueden disparar
// mientras readFileSync bloquea:
const blockedTimer = setTimeout(() => {
  console.log('⚠️  Este setTimeout tenía 0ms pero esperó al bloqueo\n');
}, 0);

// Forzamos el bloqueo leyendo de nuevo para exagerar el efecto
const blockStart = Date.now();
for (let i = 0; i < 3; i++) fs.readFileSync(FILE, 'utf8');
console.log(`   Loop síncrono tardó ${Date.now() - blockStart}ms — el timer de arriba esperó todo ese tiempo\n`);

clearTimeout(blockedTimer); // cancelamos para no ensuciar la demo

console.log('─'.repeat(55));
console.log('DEMO 2 — Lectura NO BLOQUEANTE (readFile)\n');

const asyncStart = Date.now();

// ✅ readFile delega a Libuv inmediatamente y devuelve el control.
// El hilo JS sigue ejecutando mientras el disco trabaja.
fs.readFile(FILE, 'utf8', (err, data) => {
  if (err) throw err;
  const asyncMs = Date.now() - asyncStart;
  console.log(`3️⃣  [I/O]   readFile completado en ${asyncMs}ms — Poll Queue`);
  console.log(`            ${data.split('\n').length} líneas leídas`);
  console.log(`            ✅ El hilo JS estuvo LIBRE todo ese tiempo\n`);
});

// Este código corre ANTES de que readFile termine — el hilo no esperó
console.log('2️⃣  [SYNC]  Este log sale ANTES de que readFile complete\n');
console.log('            → el hilo JS siguió ejecutando mientras Libuv leía el disco\n');

/**
 * Salida esperada:
 *
 *  ── DEMO 1 — Lectura BLOQUEANTE ──
 *  1️⃣  [SYNC]  readFileSync completado en 0ms
 *              ⚠️  El hilo JS estuvo bloqueado
 *     Loop síncrono tardó Xms
 *
 *  ── DEMO 2 — Lectura NO BLOQUEANTE ──
 *  2️⃣  [SYNC]  Este log sale ANTES de que readFile complete
 *              → el hilo JS siguió ejecutando
 *  3️⃣  [I/O]   readFile completado — Poll Queue
 *
 * Lecciones clave:
 *  - readFileSync detiene el Event Loop completamente.
 *  - readFile devuelve el control inmediatamente; el callback llega por Poll.
 *  - Nunca uses *Sync en el hilo principal de un servidor bajo carga.
 */
