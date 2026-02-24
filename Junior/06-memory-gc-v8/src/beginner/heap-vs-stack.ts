/**
 * heap-vs-stack.ts — Stack vs Heap en profundidad
 *
 * Objetivo: entender dónde viven los datos, la diferencia entre copia por
 * valor y copia por referencia, y por qué los closures retienen memoria.
 */

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(3) + ' MB';
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 1: Stack — primitivos y copia por valor
// Los primitivos (number, string, boolean, null, undefined, symbol, bigint)
// viven en el Stack. Cuando asignas uno a otra variable, se copia el VALOR.
// ─────────────────────────────────────────────────────────────────────────────
function demo1Stack(): void {
  console.log('─── DEMO 1: Stack — primitivos, copia por valor ───');

  let x = 10;
  let y = x;      // y recibe una COPIA del valor 10
  y = 999;        // modificar y NO afecta a x

  console.log(`  x = ${x}  ← original sin cambios`);
  console.log(`  y = ${y}  ← copia completamente independiente`);

  let str1 = 'hola';
  let str2 = str1;
  str2 = 'adios';
  console.log(`  str1 = "${str1}"  ← no cambió`);
  console.log(`  str2 = "${str2}"  ← copia independiente`);

  console.log('\n  ✅ Stack: acceso O(1), liberación automática al salir del scope');
  console.log('  ⚠️  Las strings en JS son inmutables — operaciones como concat crean');
  console.log('     nuevas strings en el heap (más adelante veremos esto)\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 2: Heap — objetos y copia por referencia
// Los objetos, arrays y funciones viven en el Heap. Una variable sólo guarda
// un PUNTERO a la dirección del objeto, no el objeto en sí.
// ─────────────────────────────────────────────────────────────────────────────
function demo2Heap(): void {
  console.log('─── DEMO 2: Heap — objetos, copia por referencia ───');

  const config1 = { host: 'localhost', port: 3000 };
  const config2 = config1;   // config2 guarda el MISMO puntero en el heap
  config2.port = 8080;       // modifica el objeto al que AMBOS apuntan

  console.log(`  config1.port = ${config1.port}  ← también cambió (mismo objeto)`);
  console.log(`  config2.port = ${config2.port}  ← apunta a la misma dirección`);
  console.log(`  ¿Son el mismo objeto? ${config1 === config2}`);

  // Para copiar sin compartir referencia:
  const config3 = { ...config1 };   // shallow copy — nuevo objeto en el heap
  config3.port = 9000;
  console.log(`\n  config1.port = ${config1.port}  ← no cambió (shallow copy)`);
  console.log(`  config3.port = ${config3.port}  ← objeto distinto`);
  console.log(`  ¿Son el mismo objeto? ${config1 === config3}`);

  // Deep copy para objetos anidados:
  const deep1 = { db: { host: 'localhost', port: 5432 } };
  const deep2 = JSON.parse(JSON.stringify(deep1));   // deep copy
  deep2.db.port = 9999;
  console.log(`\n  deep1.db.port = ${deep1.db.port}  ← shallow copy habría fallado aquí`);
  console.log(`  deep2.db.port = ${deep2.db.port}  ← deep copy correcto`);
  console.log('\n  ✅ Heap: objetos viven hasta que el GC los elimina\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 3: Closures y retención de memoria
// Una closure captura el scope de la función donde fue creada. Si ese scope
// contiene objetos grandes, permanecen en el heap mientras la closure viva.
// ─────────────────────────────────────────────────────────────────────────────
function demo3Closures(): void {
  console.log('─── DEMO 3: Closures — retención de referencias en el heap ───');

  // ⚠️ Closure que retiene un array grande — no puede ser GC'd
  function createRetainer() {
    const bigData = new Array(100_000).fill('x');   // ~800KB en el heap
    return function accessor() {
      return bigData.length;    // closure captura bigData → previene GC
    };
  }

  const getLength = createRetainer();   // bigData vive mientras getLength exista
  console.log(`  Closure retiene un array de ${getLength()} elementos`);
  console.log('  bigData NO puede ser recolectado mientras "getLength" esté en scope');

  // ✅ Closure limpia: libera la referencia cuando ya no la necesitas
  function createLeanClosure() {
    const bigData = new Array(100_000).fill('y');
    const result = bigData.length;   // guarda solo lo que necesita
    // bigData no se captura — puede ser GC'd al salir de createLeanClosure
    return function getLean() {
      return result;                 // sólo el número primitivo
    };
  }

  const getLean = createLeanClosure();
  console.log(`\n  Closure limpia devuelve: ${getLean()}`);
  console.log('  bigData fue liberado (no capturado por la closure)\n');

  // ✅ Regla: captura solo lo necesario, no el scope completo por defecto
  console.log('  Regla: cuanto más pequeño el scope capturado → menos presión en el heap\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 4: Impacto real en el heap — medir con process.memoryUsage()
// ─────────────────────────────────────────────────────────────────────────────
function demo4HeapImpact(): void {
  console.log('─── DEMO 4: Impacto en el heap — mediciones reales ───');

  const before = process.memoryUsage().heapUsed;

  // Crear 50.000 objetos en el heap
  const objects: object[] = [];
  for (let i = 0; i < 50_000; i++) {
    objects.push({ id: i, value: Math.random(), tag: `item-${i}` });
  }

  const afterAlloc = process.memoryUsage().heapUsed;
  const allocated  = ((afterAlloc - before) / 1024 / 1024).toFixed(2);
  console.log(`  50.000 objetos creados: +${allocated} MB en heapUsed`);

  // Perder la referencia → elegibles para GC
  objects.length = 0;   // vacía el array → los objetos pierden su última referencia

  // Nota: el GC no es síncrono; puede que heapUsed no baje de inmediato.
  // En producción se puede forzar con --expose-gc + global.gc() para tests.
  const afterClear = process.memoryUsage().heapUsed;
  const released   = ((afterAlloc - afterClear) / 1024 / 1024).toFixed(2);
  console.log(`  Después de objects.length = 0: ≈ ${released} MB liberados (depende del GC)`);
  console.log('  El GC opera en background — la liberación no es inmediata\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
function main(): void {
  console.log('========================================');
  console.log(' Heap vs Stack — Beginner               ');
  console.log('========================================\n');

  demo1Stack();
  demo2Heap();
  demo3Closures();
  demo4HeapImpact();

  console.log('========================================');
  console.log(' Resumen                                ');
  console.log('========================================');
  console.log('  Stack    : primitivos, copia por valor, liberación automática');
  console.log('  Heap     : objetos/arrays/funciones, copia por referencia');
  console.log('  Closure  : captura scope — puede retener objetos grandes en heap');
  console.log('  GC       : libera objetos sin referencias (no síncrono)');
  console.log('  Shallow  : { ...obj } — nuevo objeto, propiedades anidadas compartidas');
  console.log('  Deep     : JSON.parse(JSON.stringify(obj)) — completamente independiente');
}

main();
