import {MongoClient} from "mongodb";

let client;
let db;

export async function connectDatabase(uri, name) {
  const nextClient = new MongoClient(uri, {serverSelectionTimeoutMS: 10000});
  try {
    await nextClient.connect();
    const nextDb = nextClient.db(name);
    await nextDb.command({ping: 1});
    client = nextClient;
    db = nextDb;
    console.log(`[database] Connected to ${name}`);
    return db;
  } catch (error) {
    await nextClient.close().catch(() => {});
    throw error;
  }
}

export function getDatabase() {
  if (!db) throw new Error("Database is not connected.");
  return db;
}

export async function closeDatabase() {
  if (client) await client.close();
  client = undefined;
  db = undefined;
}
