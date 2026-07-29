// supabaseBackend.js — cloud storage engine, same function signatures as
// indexedDbBackend.js. Requires a signed-in Supabase user (see
// supabaseAuth.js) because every row is scoped by user_id + RLS.
//
// Each "store" (customers, products, tickets, ...) maps directly to a
// real Postgres table of the same name — see /supabase/schema.sql. This
// file stays generic by converting camelCase JS fields <-> snake_case
// columns automatically, so adding a field to a form only requires
// adding the column in schema.sql, not touching this file.

import { supabase } from "./supabaseClient";

function toSnakeCase(key) {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function toCamelCase(key) {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// DB -> app: snake_case columns to camelCase fields. Nulls become "" so
// controlled form inputs never receive null (React warns on that).
function rowToRecord(row) {
  const record = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "user_id") continue;
    record[toCamelCase(k)] = v === null ? "" : v;
  }
  return record;
}

// app -> DB: camelCase fields to snake_case columns. "" becomes null so
// empty date/optional fields don't fail Postgres type validation.
function recordToRow(record, userId) {
  const row = { user_id: userId };
  for (const [k, v] of Object.entries(record)) {
    row[toSnakeCase(k)] = v === "" ? null : v;
  }
  return row;
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error("Not signed in to Supabase — call signIn() first (see supabaseAuth.js).");
  }
  return data.user.id;
}

export async function getAll(store) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from(store)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToRecord);
}

export async function getOne(store, id) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from(store)
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToRecord(data) : null;
}

export async function put(store, record) {
  const userId = await currentUserId();
  const now = new Date().toISOString();
  const withTimestamps = {
    ...record,
    createdAt: record.createdAt || now,
    updatedAt: now,
  };
  const row = recordToRow(withTimestamps, userId);
  const { data, error } = await supabase.from(store).upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  return rowToRecord(data);
}

export async function remove(store, id) {
  const userId = await currentUserId();
  const { error } = await supabase.from(store).delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

export async function bulkPut(store, records) {
  const userId = await currentUserId();
  const now = new Date().toISOString();
  const rows = records.map((r) =>
    recordToRow({ ...r, createdAt: r.createdAt || now, updatedAt: now }, userId)
  );
  const { error } = await supabase.from(store).upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

export async function clearStore(store) {
  const userId = await currentUserId();
  const { error } = await supabase.from(store).delete().eq("user_id", userId);
  if (error) throw error;
}

export async function isSeeded() {
  const userId = await currentUserId();
  const { count, error } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return (count || 0) > 0;
}
