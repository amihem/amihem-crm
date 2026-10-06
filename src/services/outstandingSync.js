// outstandingSync.js — cloud copy of the Outstanding module state (report
// snapshot, customer links, sent marks, settings) in Supabase, one row per
// user, so every device logged in with the same account sees the same data.
// localStorage (utils/outstanding.js) stays as the instant/offline cache.

import { supabase, isSupabaseConfigured } from "./supabaseClient";

const TABLE = "outstanding_state";

async function userId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

export const isSetupError = (e) =>
  e?.code === "42P01" || e?.code === "42703" || e?.code === "PGRST205" || e?.code === "PGRST204" || /does not exist|schema cache/i.test(e?.message || "");

export async function pullState(source = "navkar") {
  if (!isSupabaseConfigured) return null;
  const id = await userId();
  if (!id) return null;
  const { data, error } = await supabase.from(TABLE).select("*").eq("user_id", id).eq("source", source).maybeSingle();
  if (error) throw error;
  return data || null;
}

// One row per (user, source) — source is the company ledger, e.g. "navkar" / "ranjan".
// patch may hold any of: snapshot, links, sent, settings (other columns are left untouched).
export async function pushState(source, patch) {
  if (!isSupabaseConfigured) return;
  const id = await userId();
  if (!id) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: id, source, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id,source" });
  if (error) throw error;
}
