import { Transaction } from "../domain/transaction.entity";
import { TransactionRepository } from "../domain/";
import { BankTransactionStream, processInBatches, WorkerPool } from "../infraestructure";

export class RunReconciliationUseCase {
  constructor(
    private readonly repository: TransactionRepository,
    private readonly bankStream: BankTransactionStream,
    private readonly workerPool: WorkerPool,
  ) {}

  async execute() {
    const stream = this.bankStream.stream();

    await processInBatches(stream as any, 500, async (batchRaw) => {
      const validatedRaw = await this.workerPool.execute(batchRaw);

      const transactions = validatedRaw.map(
        (tx: any) => new Transaction(tx.id, tx.amount, tx.timestamp, tx.hash),
      );

      await this.repository.saveBatch(transactions);
    });
  }
}
