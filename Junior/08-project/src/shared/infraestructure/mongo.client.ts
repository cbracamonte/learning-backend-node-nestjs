import { MongoClient } from "mongodb";

let client: MongoClient;

export async function connectMongo() {
  client = new MongoClient("mongodb://localhost:27017");
  await client.connect();
}

export function getMongoClient() {
  return client;
}
