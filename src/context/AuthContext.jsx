// AuthContext.jsx
//
// Two things live here, and they're independent:
//
// 1. ROLE (Admin/Manager/Sales Executive) — UI-level gating ONLY. Hides
//    buttons like "Remove" from certain roles. NOT security by itself.
//
// 2. IDENTITY — where this comes from depends on the active backend:
//    - IndexedDB backend: identity is just a typed name, no real check.
//    - Supabase backend: identity is a real signed-in Supabase user
//      (email+password), which is what actually secures each person's
//      data via Row Level Security (see supabase/schema.sql). Role is
//      still just a local UI preference on top of that real identity.

import { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { getCurrentUser, onAuthChange, signOut as supabaseSignOut } from "../services/supabaseAuth";

const STORAGE_KEY = "amihem_crm_session";
const ROLE_KEY = "amihem_crm_role";

export const ROLES = ["Admin", "Manager", "Sales Executive"];

// What each role can do. Extend here as new permission-gated actions appear.
export const PERMISSIONS = {
  Admin: { canDelete: true, canManageMasters: true, canAccessSettings: true },
  Manager: { canDelete: false, canManageMasters: true, canAccessSettings: true },
  "Sales Executive": { canDelete: false, canManageMasters: true, canAccessSettings: false },
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // --- IndexedDB mode: local name+role session, nothing to verify ---
  useEffect(() => {
    if (isSupabaseConfigured) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setSession(JSON.parse(raw)); } catch { /* ignore corrupt session */ }
    }
    setLoaded(true);
  }, []);

  // --- Supabase mode: real session, role is a local preference on top ---
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let unsubscribe = () => {};

    (async () => {
      const user = await getCurrentUser();
      applySupabaseUser(user);
      setLoaded(true);
      unsubscribe = onAuthChange(applySupabaseUser);
    })();

    return () => unsubscribe();
  }, []);

  function applySupabaseUser(user) {
    if (!user) { setSession(null); return; }
    const role = localStorage.getItem(ROLE_KEY) || "Sales Executive";
    setSession({ name: user.email, role, supabaseUserId: user.id });
  }

  // Local (IndexedDB mode) login — name + role, no verification.
  const login = (name, role) => {
    const s = { name, role };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setSession(s);
  };

  // Supabase mode: called after a real signIn()/signUp() succeeds, just
  // to attach the chosen role. Identity itself already came from Supabase.
  const setRole = (role) => {
    localStorage.setItem(ROLE_KEY, role);
    setSession((s) => (s ? { ...s, role } : s));
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabaseSignOut();
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setSession(null);
  };

  const permissions = session ? PERMISSIONS[session.role] : null;

  return (
    <AuthContext.Provider value={{ session, permissions, login, setRole, logout, loaded, isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
