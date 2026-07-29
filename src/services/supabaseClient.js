// supabaseClient.js — single Supabase client instance, shared across the
// app. Only initialized when the env vars are present, so the app still
// runs (on IndexedDB) if someone clones this repo without a Supabase
// project set up.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
