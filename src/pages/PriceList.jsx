import { useMemo, useRef, useState } from "react";
import { Plus, Upload, FileSpreadsheet, FileText, Share2, Pencil, Trash2, Search } from "lucide-react";
import { usePriceList } from "../context/domains.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import Modal from "../components/Modal.jsx";
import { Field, TextInput, Select } from "../components/FormField.jsx";
import { PRICE_LIST_PACKING } from "../data/schema";
import { formatCurrency, toCSV, downloadCSV, buildPDF, downloadBlob, shareOrDownloadPDF, formatDate } from "../utils/helpers";
import { parseSpreadsheet, mapPriceListRows } from "../services/backupImport";

// Official-style WhatsApp glyph — lucide has no brand icon for it, and a
// generic chat bubble (Share2/MessageCircle) doesn't read as "WhatsApp"
// at a glance the way this does.
function WhatsAppIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.014 2C6.487 2 2 6.487 2 12.014a9.98 9.98 0 0 0 1.464 5.222L2 22l4.898-1.437a9.98 9.98 0 0 0 5.116 1.405h.004c5.527 0 10.014-4.487 10.014-10.014C22.032 6.427 17.545 2 12.014 2zm0 18.166a8.13 8.13 0 0 1-4.147-1.135l-.297-.176-3.082.904.917-3.007-.194-.31a8.11 8.11 0 0 1-1.245-4.328c0-4.484 3.649-8.132 8.152-8.132 2.176 0 4.221.848 5.76 2.388a8.086 8.086 0 0 1 2.388 5.752c-.004 4.484-3.652 8.136-8.156 8.136z" />
    </svg>
  );
}

function buildPriceMessage(item) {
  return `${item.category || "Fabric"} — ${item.construction || ""}\nMill: ${item.millName || "—"}\nWidth: ${item.width || "—"} | GSM: ${item.gsm || "—"} | OZ: ${item.oz || "—"}\nPacking: ${item.packingType || "—"}\n\nRFD Rate: ₹${item.rfdRate ? formatCurrency(item.rfdRate) : "—"}\nDyed Rate: ₹${item.dyedRate ? formatCurrency(item.dyedRate) : "—"}\n\n${item.listDate ? `Rate as of ${formatDate(item.listDate)}` : ""}`;
}

// Sorts "RPF-2" before "RPF-10" instead of plain alphabetical order,
// by comparing the numeric run in each segment where one exists.
function naturalCompare(a = "", b = "") {
  const ax = String(a).match(/(\d+|\D+)/g) || [];
  const bx = String(b).match(/(\d+|\D+)/g) || [];
  const len = Math.max(ax.length, bx.length);
  for (let i = 0; i < len; i++) {
    const av = ax[i] || "", bv = bx[i] || "";
    const an = /^\d+$/.test(av), bn = /^\d+$/.test(bv);
    if (an && bn) {
      const diff = Number(av) - Number(bv);
      if (diff !== 0) return diff;
    } else {
      const diff = av.localeCompare(bv);
      if (diff !== 0) return diff;
    }
  }
  return 0;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const BLANK = {
  category: "", rpNumber: "", millName: "", width: "", construction: "",
  glm: "", gsm: "", oz: "", packingType: "LUMP", rfdRate: "", dyedRate: "", listDate: "", remarks: "",
};

const COLUMNS = [
  { key: "category", label: "Category" },
  { key: "rpNumber", label: "RP No." },
  { key: "millName", label: "Mill" },
  { key: "width", label: "Width" },
  { key: "construction", label: "Construction" },
  { key: "glm", label: "GLM" },
  { key: "gsm", label: "GSM" },
  { key: "oz", label: "OZ" },
  { key: "packingType", label: "Packing" },
  { key: "rfdRate", label: "RFD Rate" },
  { key: "dyedRate", label: "Dyed Rate" },
  { key: "listDate", label: "List Date" },
];

export default function PriceList() {
  const { items, save, remove } = usePriceList();
  const { permissions } = useAuth();
  const confirmDialog = useConfirm();
  const showToast = useToast();
  const importRef = useRef();

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => !categoryFilter || i.category === categoryFilter)
      .filter((i) => !q || [i.rpNumber, i.millName, i.construction, i.category].filter(Boolean).join(" ").toLowerCase().includes(q))
      .sort((a, b) => naturalCompare(a.category, b.category) || naturalCompare(a.rpNumber, b.rpNumber));
  }, [items, query, categoryFilter]);

  const handleSave = async (form) => {
    await save(form);
    setEditing(null);
    showToast("Price list item saved.", "success");
  };

  const handleDelete = async (item) => {
    const ok = await confirmDialog(`Remove ${item.rpNumber || item.millName} from the price list?`);
    if (!ok) return;
    await remove(item.id);
    showToast("Removed.", "success");
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const rows = await parseSpreadsheet(file);
      const mapped = mapPriceListRows(rows);
      let created = 0;
      let updated = 0;
      for (const record of mapped) {
        const existing = items.find((i) => i.rpNumber && record.rpNumber && i.rpNumber.trim().toLowerCase() === record.rpNumber.trim().toLowerCase());
        if (existing) {
          // Merge in only the non-empty fields from this row, so blank
          // cells in the sheet don't wipe out data already on file —
          // this is what lets a re-import patch in GLM/GSM/OZ (or any
          // other field) for rows that already exist.
          const merged = { ...existing };
          for (const key of Object.keys(record)) {
            if (record[key]) merged[key] = record[key];
          }
          await save(merged);
          updated += 1;
        } else {
          await save(record);
          created += 1;
        }
      }
      showToast(`Imported ${created} new item(s), updated ${updated} existing from ${rows.length} rows.`, "success");
    } catch (err) {
      showToast(err.message || "Could not read that file.", "error");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const handleExcelExport = () => {
    downloadCSV("price-list.csv", toCSV(filtered, COLUMNS));
    showToast("Price list exported as CSV.", "success");
  };

  const handlePDFDownload = async () => {
    setBusy(true);
    try {
      const blob = await buildPDF("Price List", filtered, COLUMNS);
      downloadBlob("price-list.pdf", blob);
      showToast("Price list downloaded as PDF.", "success");
    } finally {
      setBusy(false);
      setPdfMenuOpen(false);
    }
  };

  const handlePDFShare = async () => {
    setBusy(true);
    try {
      const blob = await buildPDF("Price List", filtered, COLUMNS);
      const result = await shareOrDownloadPDF("price-list.pdf", blob);
      showToast(result === "downloaded" ? "Downloaded instead — sharing isn't supported here." : "Shared.", result === "downloaded" ? "info" : "success");
    } finally {
      setBusy(false);
      setPdfMenuOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Price List</h1>
          <p className="text-muted text-sm mt-1">{items.length} qualities across {categories.length} categories</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
          <button
            onClick={() => importRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-panel border border-line hover:bg-paper disabled:opacity-40"
          >
            <Upload size={14} /> Import Excel
          </button>
          <button
            onClick={() => setEditing({ ...BLANK, listDate: todayStr() })}
            className="flex items-center gap-1.5 bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink2"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search RP no., mill, construction, category…"
            className="w-full border border-line rounded-lg pl-9 pr-3 py-2.5 text-sm bg-white outline-none focus:border-ink2"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-line rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-ink2 w-fit"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={handleExcelExport}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-ink text-white hover:bg-ink2 disabled:opacity-30"
        >
          <FileSpreadsheet size={14} /> Excel
        </button>
        <button
          onClick={() => setPdfMenuOpen(true)}
          disabled={filtered.length === 0 || busy}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-panel border border-line hover:bg-paper disabled:opacity-30"
        >
          <FileText size={14} /> PDF
        </button>
      </div>

      <div className="overflow-x-auto bg-panel border border-line rounded-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wide border-b border-line">
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">RP No.</th>
              <th className="px-4 py-3">Mill</th>
              <th className="px-4 py-3">Width</th>
              <th className="px-4 py-3">Construction</th>
              <th className="px-4 py-3">GLM/GSM/OZ</th>
              <th className="px-4 py-3">Packing</th>
              <th className="px-4 py-3">RFD Rate</th>
              <th className="px-4 py-3">Dyed Rate</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} className="border-b border-line last:border-0 hover:bg-paper">
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-thread/10 text-thread border border-thread/30">{i.category || "—"}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{i.rpNumber || "—"}</td>
                <td className="px-4 py-3 text-muted">{i.millName || "—"}</td>
                <td className="px-4 py-3 text-muted">{i.width || "—"}</td>
                <td className="px-4 py-3 text-muted">{i.construction || "—"}</td>
                <td className="px-4 py-3 text-muted text-xs">{[i.glm, i.gsm, i.oz].filter(Boolean).join(" / ") || "—"}</td>
                <td className="px-4 py-3 text-muted">{i.packingType || "—"}</td>
                <td className="px-4 py-3 font-semibold">{i.rfdRate ? `₹${formatCurrency(i.rfdRate, 2)}` : "—"}</td>
                <td className="px-4 py-3 font-semibold">{i.dyedRate ? `₹${formatCurrency(i.dyedRate, 2)}` : "—"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(buildPriceMessage(i))}`}
                    target="_blank" rel="noreferrer"
                    className="text-[#25D366] hover:opacity-80 mr-2 inline-flex"
                    title="Send via WhatsApp"
                  >
                    <WhatsAppIcon size={16} />
                  </a>
                  <button onClick={() => setEditing(i)} className="text-ink2 hover:text-ink mr-2" title="Edit">
                    <Pencil size={14} />
                  </button>
                  {permissions?.canDelete && (
                    <button onClick={() => handleDelete(i)} className="text-rust hover:opacity-80" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-muted">No price list items match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit Price List Item" : "Add Price List Item"} wide>
        {editing && <PriceListForm initial={editing} categories={categories} onSave={handleSave} onCancel={() => setEditing(null)} />}
      </Modal>

      <Modal open={pdfMenuOpen} onClose={() => setPdfMenuOpen(false)} title="Price List PDF">
        <div className="flex flex-col gap-2">
          <button onClick={handlePDFDownload} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line hover:bg-paper text-left">
            <FileText size={18} className="text-ink2 shrink-0" />
            <div>
              <div className="text-sm font-semibold">Download PDF</div>
              <div className="text-xs text-muted">Saves the file to this device.</div>
            </div>
          </button>
          <button onClick={handlePDFShare} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line hover:bg-paper text-left">
            <Share2 size={18} className="text-loom shrink-0" />
            <div>
              <div className="text-sm font-semibold">Share via WhatsApp</div>
              <div className="text-xs text-muted">Opens your phone's share sheet.</div>
            </div>
          </button>
        </div>
      </Modal>
    </div>
  );
}

function PriceListForm({ initial, categories, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Whenever a rate is entered or changed, the "List Updated Date" bumps
  // to today automatically — that field exists specifically to answer
  // "when did this price last change", so it shouldn't rely on someone
  // remembering to update it by hand.
  const setRate = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value, listDate: todayStr() }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="grid sm:grid-cols-2 gap-3">
      <Field label="Category">
        <input list="pl-categories" value={form.category} onChange={set("category")} placeholder="e.g. RFD, FORMAL, ECRU"
          className="border border-line rounded-lg px-3 py-2 text-sm bg-white w-full outline-none focus:border-ink2" />
        <datalist id="pl-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label="RP No."><TextInput value={form.rpNumber} onChange={set("rpNumber")} placeholder="e.g. RPF-1" /></Field>
      <Field label="Mill Name"><TextInput value={form.millName} onChange={set("millName")} /></Field>
      <Field label="Construction / Weave"><TextInput value={form.construction} onChange={set("construction")} /></Field>
      <Field label="Packing Type"><Select options={PRICE_LIST_PACKING} value={form.packingType} onChange={set("packingType")} /></Field>
      <Field label="List Updated Date">
        <TextInput type="date" value={form.listDate} onChange={set("listDate")} />
      </Field>

      <Field label="Width (inch)"><TextInput value={form.width} onChange={set("width")} placeholder="e.g. 58" /></Field>

      <div className="sm:col-span-2 grid grid-cols-3 gap-3">
        <Field label="GLM"><TextInput type="number" value={form.glm} onChange={set("glm")} placeholder="g/linear m" /></Field>
        <Field label="GSM"><TextInput type="number" value={form.gsm} onChange={set("gsm")} placeholder="g/m²" /></Field>
        <Field label="OZ"><TextInput type="number" value={form.oz} onChange={set("oz")} placeholder="oz/yd²" /></Field>
      </div>

      <Field label="RFD Rate (₹)"><TextInput type="number" value={form.rfdRate} onChange={setRate("rfdRate")} /></Field>
      <Field label="Dyed Rate (₹)"><TextInput type="number" value={form.dyedRate} onChange={setRate("dyedRate")} /></Field>

      <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper">Cancel</button>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink2">Save</button>
      </div>
    </form>
  );
}
