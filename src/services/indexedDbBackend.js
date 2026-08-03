// indexedDbBackend.js — the original offline-first storage engine.
// Implements the same function signatures as supabaseBackend.js so
// dataService.js can swap between them without touching any component.

import { openDB } from "idb";
import { STORES } from "./stores";

const DB_NAME = "amihem_crm";
const DB_VERSION = 4;

let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const store of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: "id" });
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function getAll(store) {
  const db = await getDB();
  return db.getAll(store);
}

export async function getOne(store, id) {
  const db = await getDB();
  return db.get(store, id);
}

export async function put(store, record) {
  const db = await getDB();
  const now = new Date().toISOString();
  const withTimestamps = {
    ...record,
    createdAt: record.createdAt || now,
    updatedAt: now,
  };
  await db.put(store, withTimestamps);
  return withTimestamps;
}

export async function remove(store, id) {
  const db = await getDB();
  return db.delete(store, id);
}

export async function bulkPut(store, records) {
  const db = await getDB();
  const tx = db.transaction(store, "readwrite");
  await Promise.all(records.map((r) => tx.store.put(r)));
  await tx.done;
}

export async function clearStore(store) {
  const db = await getDB();
  return db.clear(store);
}

export async function isSeeded() {
  const customers = await getAll(STORES.customers);
  return customers.length > 0;
}
