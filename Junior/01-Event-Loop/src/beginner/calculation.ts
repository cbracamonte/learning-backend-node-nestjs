function heavyCPUCalculation() {
  const start = Date.now();

  console.log("⏳ Iniciando cálculo pesado...");

  console.log("🚨 Bloqueo del Hilo Principal");
  while (Date.now() - start < 5000) {
    // Simulamos un cálculo pesado que dura 5 segundos
    // No hacemos nada aquí, solo bloqueamos el hilo principal
    // Esto es solo para simular una tarea que consume mucho tiempo de CPU
  }

  console.log("✅ Cálculo pesado finalizado");

  setTimeout(() => {
    console.log("🚨 Hemos recibido tus transacciones");
  }, 0);
}

heavyCPUCalculation();

// Solución real para no bloquear el hilo principal:
// dividir el trabajo pesado en bloques pequeños y ceder el control al Event Loop entre bloques.

function heavyCPUCalculationNonBlocking(totalMs = 5000, chunkMs = 25) {
  console.log("⏳ Iniciando cálculo pesado SIN bloquear el hilo principal...");

  const startedAt = Date.now();

  function processChunk() {
    const chunkStart = Date.now();

    while (Date.now() - chunkStart < chunkMs && Date.now() - startedAt < totalMs) {
      // Simulación de trabajo CPU
    }

    if (Date.now() - startedAt < totalMs) {
      setImmediate(processChunk);
      return;
    }

    console.log("✅ Cálculo pesado finalizado (sin bloquear el hilo principal)");
  }

  processChunk();
}

heavyCPUCalculationNonBlocking();
console.log("🟢 El hilo principal sigue respondiendo mientras avanza el cálculo...");
