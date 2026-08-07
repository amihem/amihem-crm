import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useCustomers, useProducts, useTickets, useFollowUps } from "../context/domains.jsx";
import { activeBackend } from "../services/dataService";
import { buildSeed } from "../data/seed";
import {
  exportBackup, restoreBackup, parseSpreadsheet, mapCustomerRows, mapProductRows,
  exportAllToExcel, shareBackup,
} from "../services/backupImport";

export default function Settings() {
  const { session, logout } = useAuth();
  const { items: customers, save: saveCustomer } = useCustomers();
  const { items: products, save: saveProduct } = useProducts();
  const { save: saveTicket } = useTickets();
  const { save: saveFollowUp } = useFollowUps();

  const restoreInputRef = useRef();
  const customerImportRef = useRef();
  const productImportRef = useRef();

  const [status, setStatus] = useState(null); // { type: 'ok'|'error', text }
  const [busy, setBusy] = useState(false);

  const handleLoadDemoData = async () => {
    setBusy(true);
    try {
      const { customers, products, tickets, followups } = buildSeed();
      for (const c of customers) await saveCustomer(c);
      for (const p of products) await saveProduct(p);
      for (const t of tickets) await saveTicket(t);
      for (const f of followups) await saveFollowUp(f);
      setStatus({ type: "ok", text: "Demo data loaded." });
    } catch (err) {
      setStatus({ type: "error", text: err.message || "Could not load demo data." });
    } finally {
      setBusy(false);
    }
  };

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

  const handleImport = async (e, mapFn, saveFn, label, isDuplicate) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const rows = await parseSpreadsheet(file);
      const mapped = mapFn(rows);
      let imported = 0;
      let skipped = 0;
      for (const record of mapped) {
        if (isDuplicate(record)) {
          skipped += 1;
          continue;
        }
        await saveFn(record);
        imported += 1;
      }
      const skippedNote = skipped > 0 ? ` (${skipped} skipped as likely duplicates)` : "";
      setStatus({ type: "ok", text: `Imported ${imported} ${label} from ${rows.length} rows${skippedNote}.` });
    } catch (err) {
      setStatus({ type: "error", text: err.message || "Could not read that file." });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const handleExcelExport = async () => {
    setBusy(true);
    try {
      await exportAllToExcel();
      setStatus({ type: "ok", text: "Excel file downloaded." });
    } catch (err) {
      setStatus({ type: "error", text: err.message || "Could not export." });
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const result = await shareBackup();
      setStatus({ type: "ok", text: result === "shared" ? "Shared." : "Your device doesn't support direct sharing — backup downloaded instead." });
    } catch (err) {
      setStatus({ type: "error", text: err.message || "Could not share." });
    } finally {
      setBusy(false);
    }
  };

  const isDuplicateCustomer = (record) => {
    const nameMatch = (a, b) => a && b && a.trim().toLowerCase() === b.trim().toLowerCase();
    const phoneMatch = (a, b) => a && b && a.replace(/\D/g, "") === b.replace(/\D/g, "");
    return customers.some((c) => nameMatch(c.name, record.name) || phoneMatch(c.phone, record.phone));
  };

  const isDuplicateProduct = (record) => {
    return products.some((p) => p.qualityName && record.qualityName &&
      p.qualityName.trim().toLowerCase() === record.qualityName.trim().toLowerCase());
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="font-display font-extrabold text-2xl">Settings</h1>
        <p className="text-muted text-sm mt-1">Backup, restore, and import data.</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <ToolbarTile icon="📊" label="Excel" tone="loom" onClick={handleExcelExport} disabled={busy} />
        <ToolbarTile icon="☁" label="Backup" tone="ink2" onClick={exportBackup} disabled={busy} />
        <ToolbarTile icon="↗" label="Share" tone="thread" onClick={handleShare} disabled={busy} />
        <ToolbarTile icon="↺" label="Restore" tone="thread" onClick={() => restoreInputRef.current?.click()} disabled={busy} />
        <ToolbarTile icon="⎋" label="Log Out" tone="rust" onClick={logout} />
      </div>
      <input ref={restoreInputRef} type="file" accept=".json" onChange={handleRestore} className="hidden" />

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

      {activeBackend === "supabase" && (
        <SettingsCard title="Demo Data" desc="New Supabase accounts start empty (unlike the local IndexedDB version, which auto-seeds). Load a few sample records to explore the app.">
          <button
            onClick={handleLoadDemoData}
            disabled={busy}
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-panel border border-line hover:bg-paper w-fit disabled:opacity-50"
          >
            Load Demo Data
          </button>
        </SettingsCard>
      )}

      <SettingsCard title="Import Customers" desc="Excel (.xlsx) or CSV with columns like Name, City, Buyer, Phone, Category. Rows matching an existing customer's name or phone are skipped automatically.">
        <input ref={customerImportRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleImport(e, mapCustomerRows, saveCustomer, "customers", isDuplicateCustomer)} className="hidden" />
        <button
          onClick={() => customerImportRef.current?.click()}
          disabled={busy}
          className="text-xs font-semibold px-3 py-2 rounded-lg bg-panel border border-line hover:bg-paper w-fit disabled:opacity-50"
        >
          Choose File…
        </button>
      </SettingsCard>

      <SettingsCard title="Import Products" desc="Excel (.xlsx) or CSV with columns like Quality Name, Category, GSM, Mill, Price. Rows matching an existing quality name are skipped automatically.">
        <input ref={productImportRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleImport(e, mapProductRows, saveProduct, "products", isDuplicateProduct)} className="hidden" />
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

const TILE_TONES = {
  loom: "bg-loom text-white",
  ink2: "bg-ink2 text-white",
  thread: "bg-thread text-white",
  rust: "bg-rust text-white",
};

function ToolbarTile({ icon, label, tone, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl py-3 text-xs font-semibold disabled:opacity-50 ${TILE_TONES[tone]}`}
    >
      <span className="text-lg leading-none">{icon}</span>
      {label}
    </button>
  );
}
