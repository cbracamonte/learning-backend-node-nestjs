import { parentPort, workerData } from "worker_threads";

const startTime = Date.now();
const targetTime = workerData.totalMs;

// Heavy CPU calculation
while (Date.now() - startTime < targetTime) {
  // Busy loop
}

const elapsedMs = Date.now() - startTime;

parentPort.postMessage({
  status: "done",
  elapsedMs,
});
