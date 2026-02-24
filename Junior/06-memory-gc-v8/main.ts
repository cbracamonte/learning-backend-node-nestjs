/**
 * main.ts — Demo básico: Stack vs Heap y métricas de memoria
 *
 * Muestra los dos lugares donde viven los datos, cómo process.memoryUsage()
 * expone el estado del heap de V8, y la diferencia entre valor y referencia.
 */

console.log('=== 06 - Memory, GC & V8 ===\n');

// ── 1. Stack: primitivos — se copian por VALOR
let a = 42;
let b = a;   // copia independiente
b = 99;
console.log('── Stack (primitivos, copia por valor):');
console.log(`   a = ${a}  ← sin cambios`);
console.log(`   b = ${b}  ← copia independiente\n`);

// ── 2. Heap: objetos — se copian por REFERENCIA
const obj1 = { nombre: 'Nodo', version: 20 };
const obj2 = obj1;   // ambas variables apuntan al MISMO objeto en el heap
obj2.version = 22;
console.log('── Heap (objetos, copia por referencia):');
console.log(`   obj1.version = ${obj1.version}  ← también cambió`);
console.log(`   obj2.version = ${obj2.version}  ← misma dirección de memoria\n`);

// ── 3. process.memoryUsage() — ventana al heap de V8
function formatToMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

const mem = process.memoryUsage();
console.log('── process.memoryUsage() — estado actual del heap:');
console.log(`   rss            : ${formatToMB(mem.rss)}`);
console.log(`     → Resident Set Size: toda la memoria del proceso en RAM`);
console.log(`   heapTotal      : ${formatToMB(mem.heapTotal)}`);
console.log(`     → Tamaño total del heap que V8 tiene reservado`);
console.log(`   heapUsed       : ${formatToMB(mem.heapUsed)}`);
console.log(`     → Heap realmente ocupado por objetos vivos`);
console.log(`   external       : ${formatToMB(mem.external)}`);
console.log(`     → Memoria de objetos C++ vinculados (Buffers, streams)`);
console.log(`   arrayBuffers   : ${formatToMB(mem.arrayBuffers)}`);
console.log(`     → ArrayBuffers y SharedArrayBuffers asignados\n`);

// ── 4. Objeto sin referencias → elegible para GC
console.log('── Ciclo de vida de un objeto:');
function createAndDiscard() {
  const temporal = { datos: new Array(1000).fill(0) };   // en el heap
  console.log(`   Objeto creado: ${temporal.datos.length} elementos`);
  // al salir de la función, 'temporal' pierde su última referencia
  // → V8 lo marca como elegible para GC
}
createAndDiscard();
console.log('   Función terminó → referencia perdida → GC puede liberar el objeto');
