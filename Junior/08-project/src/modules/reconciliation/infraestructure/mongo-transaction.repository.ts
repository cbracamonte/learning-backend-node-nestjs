import { TransactionRepository } from "../domain/transaction.repository";
import { Transaction } from "../domain/transaction.entity";
import { getMongoClient } from "../../../shared/infraestructure";

export class MongoTransactionRepository implements TransactionRepository {
  async saveBatch(transactions: Transaction[]): Promise<void> {
    const client = getMongoClient();
    await client.db("bank").collection("transactions").insertMany(transactions);
  }
}
