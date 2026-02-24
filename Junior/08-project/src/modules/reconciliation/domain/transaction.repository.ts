import { Transaction } from "./transaction.entity";

export interface TransactionRepository {
  saveBatch(transactions: Transaction[]): Promise<void>;
}
