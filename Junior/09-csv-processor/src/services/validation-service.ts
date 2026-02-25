import { Worker } from "worker_threads";
import path from "path";
import os from "os";
import { User } from "../types";

type PendingTask = {
  user: User;
  resolve: (result: boolean) => void;
  reject: (err: Error) => void;
};

type WorkerState = {
  worker: Worker;
  idle: boolean;
  currentTaskId: number | null;
};

let pool: WorkerState[] = [];
let initialized = false;

const pending = new Map<number, { resolve: (v: boolean) => void; reject: (e: Error) => void }>();
const taskQueue: PendingTask[] = [];
let nextTaskId = 0;

const POOL_SIZE = os.cpus().length;

function initPool(): void {
  if (initialized) return;
  initialized = true;

  for (let i = 0; i < POOL_SIZE; i++) {
    const worker = new Worker(
      path.resolve(__dirname, "../workers/validation-worker.ts"),
      { execArgv: ["--require", "ts-node/register"] },
    );

    const state: WorkerState = { worker, idle: true, currentTaskId: null };

    worker.on("message", ({ taskId, result }: { taskId: number; result: boolean }) => {
      const task = pending.get(taskId);
      if (task) {
        pending.delete(taskId);
        task.resolve(result);
      }
      state.idle = true;
      state.currentTaskId = null;
      dispatch(state);
    });

    worker.on("error", (err) => {
      if (state.currentTaskId !== null) {
        const task = pending.get(state.currentTaskId);
        if (task) {
          pending.delete(state.currentTaskId);
          task.reject(err instanceof Error ? err : new Error(String(err)));
        }
      }
      state.idle = true;
      state.currentTaskId = null;
      dispatch(state);
    });

    pool.push(state);
  }
}

function dispatch(state: WorkerState): void {
  if (taskQueue.length === 0) return;

  const next = taskQueue.shift()!;
  const taskId = nextTaskId++;

  pending.set(taskId, { resolve: next.resolve, reject: next.reject });
  state.idle = false;
  state.currentTaskId = taskId;
  state.worker.postMessage({ taskId, user: next.user });
}

export function validateInWorker(user: User): Promise<boolean> {
  initPool();

  return new Promise((resolve, reject) => {
    const idleWorker = pool.find((w) => w.idle);

    if (idleWorker) {
      const taskId = nextTaskId++;
      pending.set(taskId, { resolve, reject });
      idleWorker.idle = false;
      idleWorker.currentTaskId = taskId;
      idleWorker.worker.postMessage({ taskId, user });
    } else {
      taskQueue.push({ user, resolve, reject });
    }
  });
}

export function shutdownPool(): Promise<number[]> {
  return Promise.all(pool.map((s) => s.worker.terminate()));
}
