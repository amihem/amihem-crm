// dataService.js
//
// SINGLE POINT OF DATA ACCESS. Every hook/page reads and writes through
// here — never call indexedDB/Supabase directly from a component.
//
// This file is a thin router: it picks IndexedDB (offline, default) or
// Supabase (cloud, cross-device) based on whether Supabase env vars are
// present, then re-exports that backend's functions unchanged. Nothing
// above this file (hooks, pages) ever needs to know which one is active.

import { STORES } from "./stores";
import { isSupabaseConfigured } from "./supabaseClient";
import * as indexedDbBackend from "./indexedDbBackend";
import * as supabaseBackend from "./supabaseBackend";

export { STORES };

const backend = isSupabaseConfigured ? supabaseBackend : indexedDbBackend;

export const getAll = backend.getAll;
export const getOne = backend.getOne;
export const put = backend.put;
export const remove = backend.remove;
export const bulkPut = backend.bulkPut;
export const clearStore = backend.clearStore;
export const isSeeded = backend.isSeeded;

export const activeBackend = isSupabaseConfigured ? "supabase" : "indexeddb";
