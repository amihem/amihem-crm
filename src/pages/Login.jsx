import { useState } from "react";
import { useAuth, ROLES } from "../context/AuthContext.jsx";
import { signIn, signUp } from "../services/supabaseAuth";

export default function Login() {
  const { login, setRole, isSupabaseConfigured } = useAuth();

  if (isSupabaseConfigured) return <SupabaseLogin onSignedIn={setRole} />;
  return <LocalLogin onLogin={login} />;
}

// --- IndexedDB mode: just a name + role, no verification ---
function LocalLogin({ onLogin }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Sales Executive");

  return (
    <Shell>
      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) onLogin(name.trim(), role); }}
        className="flex flex-col gap-4"
      >
        <Field label="Your Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rakesh"
            required
            className="border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-ink2"
          />
        </Field>
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value)} className="border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-ink2">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <p className="text-xs text-muted -mt-1">
          This just personalizes what you see — there's no password because
          this app runs entirely on your device, with no server behind it.
        </p>
        <button type="submit" className="bg-ink text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-ink2 transition">
          Continue
        </button>
      </form>
    </Shell>
  );
}

// --- Supabase mode: real email+password, needed for RLS to work ---
function SupabaseLogin({ onSignedIn }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRoleChoice] = useState("Sales Executive");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp(email, password);
        setError("Account created — check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        await signIn(email, password);
        onSignedIn(role); // attaches the chosen role to the now-active session
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex gap-2 text-xs font-semibold">
          <button type="button" onClick={() => setMode("signin")} className={`px-3 py-1.5 rounded-full border ${mode === "signin" ? "bg-ink text-white border-ink" : "border-line text-muted"}`}>
            Sign In
          </button>
          <button type="button" onClick={() => setMode("signup")} className={`px-3 py-1.5 rounded-full border ${mode === "signup" ? "bg-ink text-white border-ink" : "border-line text-muted"}`}>
            Create Account
          </button>
        </div>

        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-ink2" />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
            className="border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-ink2" />
        </Field>
        {mode === "signin" && (
          <Field label="Role (this device)">
            <select value={role} onChange={(e) => setRoleChoice(e.target.value)} className="border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-ink2">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        )}

        {error && <p className="text-xs text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">{error}</p>}

        <button type="submit" disabled={busy} className="bg-ink text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-ink2 transition disabled:opacity-50">
          {busy ? "Please wait…" : mode === "signup" ? "Create Account" : "Sign In"}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-4">
      <div className="bg-panel border border-line rounded-2xl p-6 sm:p-8 w-full max-w-sm shadow-sm">
        <div className="mb-5">
          <h1 className="font-display font-extrabold text-2xl text-ink">Amihem CRM</h1>
          <p className="text-muted text-sm mt-1">Sample → Order Conversion</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink/80">{label}</span>
      {children}
    </label>
  );
}
