import { useState } from "react";
import { useAuth, ROLES } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [role, setRole] = useState("Sales Executive");

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-4">
      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) login(name.trim(), role); }}
        className="bg-panel border border-line rounded-2xl p-6 sm:p-8 w-full max-w-sm flex flex-col gap-4 shadow-sm"
      >
        <div>
          <h1 className="font-display font-extrabold text-2xl text-ink">Amihem CRM</h1>
          <p className="text-muted text-sm mt-1">Sample → Order Conversion</p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink/80">Your Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rakesh"
            required
            className="border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-ink2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink/80">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-ink2"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>

        <p className="text-xs text-muted -mt-1">
          This just personalizes what you see — there's no password because
          this app runs entirely on your device, with no server behind it.
        </p>

        <button
          type="submit"
          className="bg-ink text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-ink2 transition"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
