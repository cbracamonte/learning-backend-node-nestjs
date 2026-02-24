function processInBatches(items: number[]) {
  const batchSize = 1000;

  function processBatch(startIndex: number) {
    const end = Math.min(startIndex + batchSize, items.length);
    for (let i = startIndex; i < end; i++) {
      // Simulamos un trabajo pesado de CPU
      console.log(`Procesando item ${items[i]} \n`);
      Math.sqrt(items[i]); // Simulamos un trabajo de CPU
    }

    if (end < items.length) {
      setImmediate(() => processBatch(end)); // Programamos el siguiente lote
    }
  }

  processBatch(0); // Iniciamos el procesamiento con el primer lote
}

console.log("Iniciando procesamiento en lotes...");

processInBatches(Array.from({ length: 5000 }, (_, i) => i + 1)); // Simulamos una gran cantidad de items
