import { MongoClient } from 'mongodb';

let client: MongoClient;

export async function connectMongo() {
  client = new MongoClient('mongodb://localhost:27017');
  await client.connect();

  const db = client.db('billing');

  // Crear índice único en externalId para garantizar idempotencia
  await db.collection('invoices').createIndex(
    { externalId: 1 },
    { unique: true }
  );
}

export function getMongoClient() {
  return client;
}