import * as path from "path";
import { Worker } from "worker_threads";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function heavyCPUCalculationWithWorker(totalMs = 5000) {
  return new Promise((resolve, reject) => {
    console.log("⏳ Iniciando cálculo pesado en Worker Thread...");

    const workerFile = path.resolve(__dirname, "cpu-worker.ts");
    const worker = new Worker(workerFile, {
      workerData: { totalMs },
    });

    worker.once("message", (message) => {
      if (message.status === "done") {
        console.log(`✅ Worker finalizó en ${message.elapsedMs}ms`);
        resolve(message);
      }
    });

    worker.once("error", (error) => {
      reject(error);
    });

    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker terminó con código ${code}`));
      }
    });
  });
}

console.log("🟢 El hilo principal está libre para atender otras tareas...");

setTimeout(() => {
  console.log("📨 Timer del hilo principal ejecutándose sin bloqueo");
}, 100);

heavyCPUCalculationWithWorker(5000)
  .then(() => {
    console.log("🏁 Demo con Worker completada");
  })
  .catch((error) => {
    console.error("❌ Error en worker:", error.message);
  });
