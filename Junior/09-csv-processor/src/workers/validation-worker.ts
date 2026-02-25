import { parentPort } from "worker_threads";
import { User } from "../types";

type TaskMessage = {
  taskId: number;
  user: User;
};

type ResultMessage = {
  taskId: number;
  result: boolean;
};

function validate(user: User): boolean {
  // Simulate heavy CPU-bound validation
  const start = Date.now();
  while (Date.now() - start < 5) {}

  if (!user.email.includes("@")) return false;
  if (user.age < 18) return false;
  return true;
}

// Stay alive and process multiple tasks
parentPort?.on("message", ({ taskId, user }: TaskMessage) => {
  const result = validate(user);
  parentPort?.postMessage({ taskId, result } satisfies ResultMessage);
});
