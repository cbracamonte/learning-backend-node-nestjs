import {
  RunReconciliationUseCase,
  ScheduleReconciliationUseCase,
} from "./application";
import {
  BankTransactionStream,
  MongoTransactionRepository,
  WorkerPool,
} from "./infraestructure";

export function createReconciliationModule() {
  const repository = new MongoTransactionRepository();
  const stream = new BankTransactionStream();
  const workerPool = new WorkerPool(4);

  const runUseCase = new RunReconciliationUseCase(
    repository,
    stream,
    workerPool,
  );

  const scheduler = new ScheduleReconciliationUseCase(runUseCase);

  return {
    start() {
      scheduler.start(5 * 60 * 1000); // cada 5 minutos
      console.log('Reconciliation module started: running every 5 minutes');
    },
  };
}
