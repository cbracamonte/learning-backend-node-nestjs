import { parentPort } from "worker_threads";
import crypto from "crypto";

parentPort?.on("message", (batch: any[]) => {
  const result = batch.map((tx) => {
    const hash = crypto
      .createHash("sha512")
      .update(JSON.stringify(tx))
      .digest("hex");

    return { ...tx, hash };
  });

  parentPort?.postMessage(result);
});
