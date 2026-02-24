import { Worker } from 'worker_threads';
import path from 'path';

function spawnWorker(): Worker {
  const workerPath = path.resolve(__dirname, 'validation.worker.ts');
  const script = `require('ts-node').register({ transpileOnly: true }); require(${JSON.stringify(workerPath)});`;
  const worker = new Worker(script, { eval: true });
  worker.setMaxListeners(0); // pool manages listeners explicitly
  return worker;
}

export class WorkerPool {
  private workers: Worker[] = [];

  constructor(private readonly size: number) {
    for (let i = 0; i < size; i++) {
      this.workers.push(spawnWorker());
    }
  }

  async execute(batch: any[]): Promise<any[]> {
    const worker = this.workers.pop();
    if (!worker) throw new Error('No worker available');

    return new Promise((resolve, reject) => {
      const onMessage = (result: any) => {
        worker.off('error', onError);
        this.workers.push(worker);
        resolve(result);
      };

      const onError = (err: Error) => {
        worker.off('message', onMessage);
        reject(err);
      };

      worker.once('message', onMessage);
      worker.once('error', onError);
      worker.postMessage(batch);
    });
  }
}