import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useCustomers, useProducts } from "../context/domains.jsx";
import {
  exportBackup, restoreBackup, parseSpreadsheet, mapCustomerRows, mapProductRows,
} from "../services/backupImport";

export default function Settings() {
  const { session, logout } = useAuth();
  const { save: saveCustomer } = useCustomers();
  const { save: saveProduct } = useProducts();

  const restoreInputRef = useRef();
  const customerImportRef = useRef();
  const productImportRef = useRef();

  const [status, setStatus] = useState(null); // { type: 'ok'|'error', text }
  const [busy, setBusy] = useState(false);

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("Restoring will merge this backup into your current data (existing records with matching IDs get overwritten). Continue?")) {
      e.target.value = "";
      return;
    }
    setBusy(true);
    try {
      await restoreBackup(file);
      setStatus({ type: "ok", text: "Backup restored. Reloading…" });
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setStatus({ type: "error", text: err.message || "Could not read that file." });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const handleImport = async (e, mapFn, saveFn, label) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const rows = await parseSpreadsheet(file);
      const mapped = mapFn(rows);
      for (const record of mapped) {
        await saveFn(record);
      }
      setStatus({ type: "ok", text: `Imported ${mapped.length} ${label} from ${rows.length} rows.` });
    } catch (err) {
      setStatus({ type: "error", text: err.message || "Could not read that file." });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="font-display font-extrabold text-2xl">Settings</h1>
        <p className="text-muted text-sm mt-1">Backup, restore, and import data.</p>
      </div>

      {status && (
        <div className={`text-sm rounded-lg px-3 py-2 border ${status.type === "ok" ? "bg-loom/10 text-loom border-loom/30" : "bg-rust/10 text-rust border-rust/30"}`}>
          {status.text}
        </div>
      )}

      <SettingsCard title="Session">
        <p className="text-sm">Signed in as <strong>{session?.name}</strong> — {session?.role}</p>
        <button onClick={logout} className="mt-2 text-xs font-semibold text-rust hover:underline w-fit">
          Sign out
        </button>
      </SettingsCard>

      <SettingsCard title="Backup" desc="Download all your data as a single JSON file — keep it somewhere safe.">
        <button
          onClick={exportBackup}
          className="text-xs font-semibold px-3 py-2 rounded-lg bg-ink text-white hover:bg-ink2 w-fit"
        >
          Download Backup
        </button>
      </SettingsCard>

      <SettingsCard title="Restore" desc="Upload a previously downloaded backup file. Existing records with the same ID will be overwritten.">
        <input ref={restoreInputRef} type="file" accept=".json" onChange={handleRestore} className="hidden" />
        <button
          onClick={() => restoreInputRef.current?.click()}
          disabled={busy}
          className="text-xs font-semibold px-3 py-2 rounded-lg bg-panel border border-line hover:bg-paper w-fit disabled:opacity-50"
        >
          Choose Backup File…
        </button>
      </SettingsCard>

      <SettingsCard title="Import Customers" desc="Excel (.xlsx) or CSV with columns like Name, City, Buyer, Phone, Category.">
        <input ref={customerImportRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleImport(e, mapCustomerRows, saveCustomer, "customers")} className="hidden" />
        <button
          onClick={() => customerImportRef.current?.click()}
          disabled={busy}
          className="text-xs font-semibold px-3 py-2 rounded-lg bg-panel border border-line hover:bg-paper w-fit disabled:opacity-50"
        >
          Choose File…
        </button>
      </SettingsCard>

      <SettingsCard title="Import Products" desc="Excel (.xlsx) or CSV with columns like Quality Name, Category, GSM, Mill, Price.">
        <input ref={productImportRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleImport(e, mapProductRows, saveProduct, "products")} className="hidden" />
        <button
          onClick={() => productImportRef.current?.click()}
          disabled={busy}
          className="text-xs font-semibold px-3 py-2 rounded-lg bg-panel border border-line hover:bg-paper w-fit disabled:opacity-50"
        >
          Choose File…
        </button>
      </SettingsCard>
    </div>
  );
}

function SettingsCard({ title, desc, children }) {
  return (
    <div className="bg-panel border border-line rounded-2xl p-4 sm:p-5 flex flex-col gap-2">
      <h3 className="font-display font-bold text-sm">{title}</h3>
      {desc && <p className="text-xs text-muted">{desc}</p>}
      {children}
    </div>
  );
}
