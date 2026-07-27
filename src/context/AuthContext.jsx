// AuthContext.jsx
//
// UI-LEVEL GATING ONLY. There is no backend, so this is NOT real security —
// anyone with browser devtools can bypass it. Its purpose is to keep the
// day-to-day UI simple for each role (e.g. hide "Remove" buttons from a
// Sales Executive) and to attribute who logged what. Don't oversell this
// to the business as access control.

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "amihem_crm_session";

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

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setSession(JSON.parse(raw)); } catch { /* ignore corrupt session */ }
    }
    setLoaded(true);
  }, []);

  const login = (name, role) => {
    const s = { name, role };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setSession(s);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  };

  const permissions = session ? PERMISSIONS[session.role] : null;

  return (
    <AuthContext.Provider value={{ session, permissions, login, logout, loaded }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
