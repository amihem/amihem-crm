// dataService.js
//
// SINGLE POINT OF DATA ACCESS. Every hook/page reads and writes through
// here — never call indexedDB/localStorage directly from a component.
//
// Why: when this app eventually moves to Supabase/Firebase/SQL, only this
// file changes. Swap the function bodies below for API calls; the
// hooks/pages that call getAll/getOne/put/remove never need to know.

import { openDB } from "idb";

const DB_NAME = "amihem_crm";
const DB_VERSION = 3;

export const STORES = {
  customers: "customers",
  products: "products",
  tickets: "tickets",
  followups: "followups",
  calls: "calls",
  inventory: "inventory",
  collections: "collections",
  visits: "visits",
};

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
