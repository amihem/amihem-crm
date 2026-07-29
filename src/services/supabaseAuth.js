// supabaseAuth.js — real authentication (unlike AuthContext.jsx, which is
// UI-only role gating). This is what actually secures each user's data
// via Supabase RLS. Wire this into AuthContext.jsx if/when you switch
// backends — see README "Switching to Supabase" section.

import { supabase, isSupabaseConfigured } from "./supabaseClient";

export async function signUp(email, password) {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signIn(email, password) {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

// Subscribe to auth state changes (sign in / sign out / token refresh).
// Returns an unsubscribe function.
export function onAuthChange(callback) {
  if (!isSupabaseConfigured) return () => {};
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
  return () => listener.subscription.unsubscribe();
}
