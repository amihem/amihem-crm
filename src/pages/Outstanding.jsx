import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, MessageCircle, Phone, Search, Link2, Download, AlertTriangle,
  CheckCircle2, Wallet, Users, Clock, Settings2, FileText, Send,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useCustomers } from "../context/domains.jsx";
import { useToast } from "../context/ToastContext.jsx";
import Modal from "../components/Modal.jsx";
import KpiCard from "../components/KpiCard.jsx";
import SearchDropdown from "../components/SearchDropdown.jsx";
import { buildWhatsAppLink } from "../services/whatsapp";
import { buildPDF, shareOrDownloadPDF, formatCurrency } from "../utils/helpers";
import {
  BUCKETS, bucketOf, fmtDate, groupParties, overdueAmount, matchParty, resolvePhone,
  buildStatementMessage, parseOutstandingFile, exportExcel,
  loadSnapshot, saveSnapshot, loadLinks, saveLinks, loadSent, saveSent,
  loadSettings, saveSettings, DEFAULT_FOOTER,
} from "../utils/outstanding";

const inr = (n) => `₹${formatCurrency(n)}`;
const TABS = [
  { id: "statements", label: "Statements · WhatsApp" },
  { id: "summary", label: "Ageing Summary" },
  { id: "bills", label: "Bill-wise Ageing" },
  { id: "priority", label: "Collection Priority" },
];

function DaysBadge({ days }) {
  const b = bucketOf(days);
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: `${b.color}1F`, color: b.color }}>
      {days}d
    </span>
  );
}

export default function Outstanding() {
  const { items: customers } = useCustomers();
  const showToast = useToast();
  const fileRef = useRef(null);

  const [snap, setSnap] = useState(() => loadSnapshot());
  const [links, setLinks] = useState(() => loadLinks());
  const [sent, setSent] = useState(() => loadSent());
  const [settings, setSettings] = useState(() => loadSettings());
  const [tab, setTab] = useState("statements");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [queue, setQueue] = useState(null); // [{key,name,phone,message}]
  const [linking, setLinking] = useState(null); // group being linked
  const [showSettings, setShowSettings] = useState(false);

  const groups = useMemo(() => (snap ? groupParties(snap.bills) : []), [snap]);
  const rows = useMemo(
    () =>
      groups.map((g) => {
        const link = links[g.key];
        const match = matchParty(g, customers, links);
        return { g, match, link, phone: resolvePhone(match, link), overdue: overdueAmount(g, settings.creditDays) };
      }),
    [groups, customers, links, settings.creditDays]
  );

  const totals = useMemo(() => {
    const t = { net: 0, due: 0, advance: 0, overdue: 0, buckets: Object.fromEntries(BUCKETS.map((b) => [b.key, 0])) };
    rows.forEach(({ g, overdue }) => {
      t.net += g.total; t.due += g.due; t.advance += g.advance; t.overdue += overdue;
      BUCKETS.forEach((b) => (t.buckets[b.key] += g.buckets[b.key]));
    });
    return t;
  }, [rows]);

  // ---------- upload ----------
  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseOutstandingFile(file);
      if (!saveSnapshot(parsed)) showToast("Loaded, but couldn't be saved on this device (storage full).", "error");
      saveSent({}); setSent({});
      setSnap(parsed);
      showToast(`${parsed.bills.length} bills · ${groupParties(parsed.bills).length} parties loaded (as on ${fmtDate(parsed.asOn)})`);
    } catch (err) {
      showToast(err.message || "Couldn't read that file.", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const updateLink = (key, link) => {
    const next = { ...links };
    if (link) next[key] = link; else delete next[key];
    setLinks(next); saveLinks(next);
  };
  const markSent = (key) => {
    const next = { ...sent, [key]: new Date().toISOString() };
    setSent(next); saveSent(next);
  };
  const updateSettings = (s) => { setSettings(s); saveSettings(s); };

  const startQueue = (list, opts) => {
    const items = list
      .filter((r) => r.phone)
      .map((r) => ({
        key: r.g.key, name: r.g.name, phone: r.phone,
        message: buildStatementMessage(r.g, snap.asOn, { creditDays: settings.creditDays, footer: settings.footer, ...opts }),
      }));
    if (!items.length) { showToast("No phone number available for the selected parties.", "error"); return; }
    if (items.length < list.length) showToast(`${list.length - items.length} skipped — no phone number.`, "info");
    setQueue(items);
  };

  // ---------- empty state ----------
  if (!snap) {
    return (
      <div className="flex flex-col gap-5">
        <Header />
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
          className={`border-2 border-dashed rounded-2xl p-10 sm:p-16 text-center bg-panel transition ${drag ? "border-ink2 bg-ink2/5" : "border-line"}`}
        >
          <div className="w-14 h-14 rounded-2xl bg-ink/10 text-ink flex items-center justify-center mx-auto mb-4"><Upload size={26} /></div>
          <h2 className="font-display font-bold text-lg">Upload party-wise outstanding</h2>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            Excel / CSV with Bill Date, Bill No, Bill Amount, Credit Amount, Outstanding, Ageing Days — grouped under “Party : NAME” rows, or as a flat sheet with a Party column.
          </p>
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="mt-5 bg-ink text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-ink2 transition disabled:opacity-50">
            {busy ? "Reading…" : "Choose file"}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>
      </div>
    );
  }

  const unmatched = rows.filter((r) => r.match.status !== "auto" && r.g.total > 0).length;

  return (
    <div className="flex flex-col gap-5">
      <Header>
        <span className="text-xs text-muted hidden sm:block">As on <b className="text-ink">{fmtDate(snap.asOn)}</b> · {snap.fileName}</span>
        <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg border border-line hover:bg-paper" aria-label="Settings"><Settings2 size={16} /></button>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink2 transition flex items-center gap-2 disabled:opacity-50">
          <Upload size={15} /> {busy ? "Reading…" : "Upload new"}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      </Header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Net Outstanding" value={inr(totals.net)} icon={Wallet} sub={`${groups.length} parties`} />
        <KpiCard label={`Overdue > ${settings.creditDays}d`} value={inr(totals.overdue)} tone="rust" icon={AlertTriangle} sub={`${totals.due ? Math.round((totals.overdue / totals.due) * 100) : 0}% of dues`} />
        <KpiCard label="Advance / Credit" value={inr(totals.advance)} tone="loom" icon={CheckCircle2} sub="adjusted in net" />
        <KpiCard label="Not linked to master" value={unmatched} tone={unmatched ? "thread" : "loom"} icon={Users} sub={unmatched ? "link before sending" : "all matched"} />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition ${tab === t.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "statements" && (
        <StatementsTab rows={rows} sent={sent} settings={settings} snap={snap} startQueue={startQueue}
          onLink={setLinking} onConfirm={(r) => updateLink(r.g.key, { ...(r.link || {}), customerId: r.match.customer.id })}
          showToast={showToast} />
      )}
      {tab === "summary" && <SummaryTab rows={rows} totals={totals} snap={snap} />}
      {tab === "bills" && <BillsTab snap={snap} />}
      {tab === "priority" && <PriorityTab rows={rows} settings={settings} startQueue={startQueue} />}

      {queue && <SendModal queue={queue} onSent={markSent} onClose={() => setQueue(null)} />}
      {linking && (
        <LinkModal group={linking} customers={customers} link={links[linking.key]}
          onSave={(l) => { updateLink(linking.key, l); setLinking(null); }}
          onClose={() => setLinking(null)} />
      )}
      <SettingsModal open={showSettings} settings={settings} onSave={(s) => { updateSettings(s); setShowSettings(false); }} onClose={() => setShowSettings(false)} />
    </div>
  );
}

function Header({ children }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="font-display font-extrabold text-2xl">Outstanding</h1>
        <p className="text-muted text-sm mt-1">Party-wise dues, ageing and WhatsApp statements</p>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

// ---------------- Tab 1: statements ----------------
function StatementsTab({ rows, sent, settings, snap, startQueue, onLink, onConfirm, showToast }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(new Set());
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [showAgeing, setShowAgeing] = useState(false);

  const eligible = (r) => r.match.status === "auto" && r.phone && r.g.total > 0;
  const list = rows.filter((r) => {
    if (q && !r.g.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "pending") return r.g.total > 0 && !sent[r.g.key];
    if (filter === "link") return r.match.status !== "auto" || !r.phone;
    if (filter === "overdue") return r.overdue > 0;
    if (filter === "advance") return r.g.total < 0;
    return true;
  });
  const toggle = (key) => setSel((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const selectable = list.filter(eligible);
  const chosen = rows.filter((r) => sel.has(r.g.key) && eligible(r));
  const opts = { onlyOverdue, showAgeing };

  const sendPdf = async (r) => {
    const bills = r.g.bills.filter((b) => b.outstanding > 0).sort((a, b) => a.date.localeCompare(b.date));
    const data = bills.map((b) => ({ date: fmtDate(b.date), billNo: b.billNo, amount: formatCurrency(b.amount), outstanding: formatCurrency(b.outstanding), days: b.days }));
    data.push({ date: "", billNo: "TOTAL", amount: "", outstanding: formatCurrency(r.g.total), days: "" });
    const blob = await buildPDF(`Outstanding — ${r.g.name} (as on ${fmtDate(snap.asOn)})`, data, [
      { key: "date", label: "Bill Date" }, { key: "billNo", label: "Bill No" }, { key: "amount", label: "Bill Amount" },
      { key: "outstanding", label: "Outstanding" }, { key: "days", label: "Days" },
    ]);
    const res = await shareOrDownloadPDF(`Outstanding_${r.g.name.replace(/\W+/g, "_")}.pdf`, blob, r.phone);
    showToast(res === "shared" ? "Shared" : "PDF downloaded — attach it in WhatsApp", "info");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search party…" className="border border-line rounded-lg pl-9 pr-3 py-2 text-sm bg-white w-full outline-none focus:border-ink2" />
        </div>
        {[["all", "All"], ["pending", "Not sent"], ["overdue", `Overdue`], ["link", "Needs link/phone"], ["advance", "Advance"]].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filter === id ? "bg-ink text-white border-ink" : "border-line hover:bg-paper"}`}>{label}</button>
        ))}
      </div>

      <div className="bg-ink2/5 border border-ink2/20 rounded-xl px-4 py-2.5 flex items-center gap-x-4 gap-y-2 flex-wrap text-sm">
        <button onClick={() => setSel(new Set(selectable.map((r) => r.g.key)))} className="text-ink2 font-semibold hover:underline">Select all ({selectable.length})</button>
        {sel.size > 0 && <button onClick={() => setSel(new Set())} className="text-muted font-semibold hover:underline">Clear</button>}
        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} /> Only bills &gt; {settings.creditDays}d</label>
        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={showAgeing} onChange={(e) => setShowAgeing(e.target.checked)} /> Add ageing summary</label>
        <button disabled={!chosen.length} onClick={() => startQueue(chosen, opts)}
          className="ml-auto bg-loom text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-40">
          <Send size={14} /> Send via WhatsApp ({chosen.length})
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {list.map((r) => {
          const ok = eligible(r);
          return (
            <div key={r.g.key} className="bg-panel border border-line rounded-xl p-3 sm:p-4 flex items-center gap-3 flex-wrap">
              <input type="checkbox" disabled={!ok} checked={sel.has(r.g.key)} onChange={() => toggle(r.g.key)} className="w-4 h-4" />
              <div className="flex-1 min-w-[180px]">
                <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                  {r.g.name}
                  {sent[r.g.key] && <span className="text-[10px] font-semibold text-loom bg-loom/10 px-1.5 py-0.5 rounded">Sent</span>}
                  {r.g.total < 0 && <span className="text-[10px] font-semibold text-loom bg-loom/10 px-1.5 py-0.5 rounded">Advance</span>}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {r.match.status === "auto" && <>{r.match.customer.name !== r.g.name ? `${r.match.customer.name} · ` : ""}{r.phone || <span className="text-thread font-semibold">No phone</span>}</>}
                  {r.match.status === "suggested" && (
                    <span className="text-thread font-semibold">Match? {r.match.customer.name}{" "}
                      <button onClick={() => onConfirm(r)} className="underline">Confirm</button>
                    </span>
                  )}
                  {r.match.status === "none" && <span className="text-rust font-semibold">Not in master</span>}
                  {" · "}{r.g.bills.length} bill{r.g.bills.length > 1 ? "s" : ""}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-display font-bold ${r.g.total < 0 ? "text-loom" : ""}`}>{inr(r.g.total)}</div>
                {r.g.due > 0 && <DaysBadge days={r.g.oldest} />}
              </div>
              <div className="flex items-center gap-1.5">
                {(r.match.status !== "auto" || !r.phone) && (
                  <button onClick={() => onLink(r.g)} className="p-2 rounded-lg border border-line hover:bg-paper text-ink2" aria-label="Link customer / phone"><Link2 size={15} /></button>
                )}
                <button disabled={!r.phone || r.g.total <= 0} onClick={() => sendPdf(r)} className="p-2 rounded-lg border border-line hover:bg-paper disabled:opacity-30" aria-label="PDF"><FileText size={15} /></button>
                <button disabled={!ok} onClick={() => startQueue([r], opts)} className="p-2 rounded-lg bg-loom text-white disabled:opacity-30" aria-label="WhatsApp"><MessageCircle size={15} /></button>
              </div>
            </div>
          );
        })}
        {!list.length && <div className="text-center text-sm text-muted py-10">Nothing to show for this filter.</div>}
      </div>
    </div>
  );
}

// ---------------- Tab 2: ageing summary ----------------
function SummaryTab({ rows, totals, snap }) {
  const data = BUCKETS.map((b) => ({ name: b.label, value: totals.buckets[b.key], color: b.color }));
  const sorted = [...rows].sort((a, b) => b.g.total - a.g.total);

  const exportRows = () => sorted.map(({ g }) => ({
    party: g.name, ...Object.fromEntries(BUCKETS.map((b) => [b.key, g.buckets[b.key]])), advance: g.advance ? -g.advance : 0, total: g.total,
  }));
  const cols = [{ key: "party", label: "Party" }, ...BUCKETS.map((b) => ({ key: b.key, label: `${b.label} days` })), { key: "advance", label: "Advance" }, { key: "total", label: "Net Total" }];
  const pdf = async () => {
    const fmt = exportRows().map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? formatCurrency(v) : v])));
    const { downloadBlob } = await import("../utils/helpers");
    downloadBlob("Ageing_Summary.pdf", await buildPDF(`Ageing Summary as on ${fmtDate(snap.asOn)}`, fmt, cols));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-panel border border-line rounded-2xl p-4">
        <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Outstanding by ageing</div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} width={52} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
              <Tooltip formatter={(v) => inr(v)} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>{data.map((d) => <Cell key={d.name} fill={d.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ExportBar onExcel={() => exportExcel(`Ageing_Summary_${snap.asOn}.xlsx`, "Ageing Summary", exportRows(), cols)} onPdf={pdf} />
      <div className="bg-panel border border-line rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-xs text-muted uppercase tracking-wide border-b border-line">
              <th className="text-left px-4 py-3">Party</th>
              {BUCKETS.map((b) => <th key={b.key} className="text-right px-3 py-3" style={{ color: b.color }}>{b.label}</th>)}
              <th className="text-right px-3 py-3">Advance</th>
              <th className="text-right px-4 py-3">Net</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ g }) => (
              <tr key={g.key} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 font-medium">{g.name}</td>
                {BUCKETS.map((b) => <td key={b.key} className={`text-right px-3 ${g.buckets[b.key] ? "" : "text-muted/50"}`}>{g.buckets[b.key] ? formatCurrency(g.buckets[b.key]) : "–"}</td>)}
                <td className="text-right px-3 text-loom">{g.advance ? `-${formatCurrency(g.advance)}` : "–"}</td>
                <td className="text-right px-4 font-semibold">{formatCurrency(g.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t-2 border-line bg-paper/60">
              <td className="px-4 py-3">Total</td>
              {BUCKETS.map((b) => <td key={b.key} className="text-right px-3">{formatCurrency(totals.buckets[b.key])}</td>)}
              <td className="text-right px-3 text-loom">-{formatCurrency(totals.advance)}</td>
              <td className="text-right px-4">{formatCurrency(totals.net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ---------------- Tab 3: bill-wise ----------------
function BillsTab({ snap }) {
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState("all");
  const [sort, setSort] = useState({ key: "days", dir: -1 });

  const list = useMemo(() => {
    const l = snap.bills.filter((b) => b.outstanding > 0)
      .filter((b) => !q || b.party.toLowerCase().includes(q.toLowerCase()) || b.billNo.toLowerCase().includes(q.toLowerCase()))
      .filter((b) => bucket === "all" || bucketOf(b.days).key === bucket);
    return [...l].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * sort.dir;
    });
  }, [snap, q, bucket, sort]);

  const total = list.reduce((s, b) => s + b.outstanding, 0);
  const th = (key, label, right) => (
    <th onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))}
      className={`${right ? "text-right" : "text-left"} px-3 py-3 cursor-pointer select-none hover:text-ink`}>
      {label}{sort.key === key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
    </th>
  );
  const cols = [
    { key: "party", label: "Party" }, { key: "billNo", label: "Bill No" }, { key: "date", label: "Bill Date" },
    { key: "amount", label: "Bill Amount" }, { key: "credit", label: "Credit" }, { key: "outstanding", label: "Outstanding" }, { key: "days", label: "Ageing Days" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Party or bill no…" className="border border-line rounded-lg pl-9 pr-3 py-2 text-sm bg-white w-full outline-none focus:border-ink2" />
        </div>
        <button onClick={() => setBucket("all")} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${bucket === "all" ? "bg-ink text-white border-ink" : "border-line hover:bg-paper"}`}>All</button>
        {BUCKETS.map((b) => (
          <button key={b.key} onClick={() => setBucket(b.key)} className="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
            style={bucket === b.key ? { background: b.color, color: "#fff", borderColor: b.color } : { color: b.color, borderColor: `${b.color}55` }}>{b.label}</button>
        ))}
      </div>
      <ExportBar
        onExcel={() => exportExcel(`Billwise_Ageing_${snap.asOn}.xlsx`, "Bill-wise", list.map((b) => ({ ...b, date: fmtDate(b.date), days: b.days })), cols)}
        onPdf={async () => {
          const { downloadBlob } = await import("../utils/helpers");
          downloadBlob("Billwise_Ageing.pdf", await buildPDF(`Bill-wise Ageing as on ${fmtDate(snap.asOn)}`, list.map((b) => ({ ...b, date: fmtDate(b.date), amount: formatCurrency(b.amount), credit: formatCurrency(b.credit), outstanding: formatCurrency(b.outstanding) })), cols));
        }}
      />
      <div className="bg-panel border border-line rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="text-xs text-muted uppercase tracking-wide border-b border-line">
            {th("party", "Party")}{th("billNo", "Bill No")}{th("date", "Bill Date")}{th("amount", "Bill Amt", true)}{th("credit", "Credit", true)}{th("outstanding", "Outstanding", true)}{th("days", "Days", true)}
          </tr></thead>
          <tbody>
            {list.map((b, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-3 py-2.5 font-medium">{b.party}</td>
                <td className="px-3">{b.billNo}</td>
                <td className="px-3 whitespace-nowrap">{fmtDate(b.date)}</td>
                <td className="px-3 text-right">{formatCurrency(b.amount)}</td>
                <td className="px-3 text-right text-muted">{b.credit ? formatCurrency(b.credit) : "–"}</td>
                <td className="px-3 text-right font-semibold">{formatCurrency(b.outstanding)}</td>
                <td className="px-3 text-right"><DaysBadge days={b.days} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="font-bold border-t-2 border-line bg-paper/60">
            <td className="px-3 py-3" colSpan={5}>{list.length} bills</td>
            <td className="px-3 text-right">{formatCurrency(total)}</td><td />
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}

// ---------------- Tab 4: collection priority ----------------
function PriorityTab({ rows, settings, startQueue }) {
  const list = rows.filter((r) => r.overdue > 0).sort((a, b) => b.overdue - a.overdue);
  const max = list[0]?.overdue || 1;
  const sendable = list.filter((r) => r.match.status === "auto" && r.phone);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted">Parties with bills older than <b className="text-ink">{settings.creditDays} days</b>, biggest overdue first.</p>
        <button disabled={!sendable.length} onClick={() => startQueue(sendable, { onlyOverdue: true })}
          className="bg-loom text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-40">
          <Send size={14} /> Remind all overdue ({sendable.length})
        </button>
      </div>
      {list.map((r, i) => (
        <div key={r.g.key} className="bg-panel border border-line rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-7 h-7 rounded-full bg-ink/10 text-ink text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-[160px]">
              <div className="font-semibold text-sm">{r.g.name}</div>
              <div className="text-xs text-muted flex items-center gap-2 mt-0.5">Oldest bill <DaysBadge days={r.g.oldest} /> · Total dues {inr(r.g.due)}</div>
            </div>
            <div className="text-right">
              <div className="font-display font-bold text-rust">{inr(r.overdue)}</div>
              <div className="text-[11px] text-muted">{Math.round((r.overdue / r.g.due) * 100)}% overdue</div>
            </div>
            <div className="flex gap-1.5">
              {r.phone && <a href={`tel:${r.phone}`} className="p-2 rounded-lg border border-line hover:bg-paper" aria-label="Call"><Phone size={15} /></a>}
              <button disabled={!(r.match.status === "auto" && r.phone)} onClick={() => startQueue([r], { onlyOverdue: true })} className="p-2 rounded-lg bg-loom text-white disabled:opacity-30" aria-label="WhatsApp reminder"><MessageCircle size={15} /></button>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-paper mt-3 overflow-hidden"><div className="h-full rounded-full bg-rust" style={{ width: `${(r.overdue / max) * 100}%` }} /></div>
        </div>
      ))}
      {!list.length && <div className="text-center text-sm text-muted py-10 flex flex-col items-center gap-2"><Clock size={22} />No overdue bills 🎉</div>}
    </div>
  );
}

function ExportBar({ onExcel, onPdf }) {
  return (
    <div className="flex gap-2 justify-end">
      <button onClick={onExcel} className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold hover:bg-paper flex items-center gap-1.5"><Download size={13} /> Excel</button>
      <button onClick={onPdf} className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold hover:bg-paper flex items-center gap-1.5"><Download size={13} /> PDF</button>
    </div>
  );
}

// ---------------- modals ----------------
// wa.me can only open one chat per tap (browsers block bulk popups), so
// multi-party sends run as a queue: preview → Open WhatsApp → next.
function SendModal({ queue, onSent, onClose }) {
  const [idx, setIdx] = useState(0);
  const item = queue[idx];
  const [msg, setMsg] = useState(item.message);
  useEffect(() => { setMsg(queue[idx].message); }, [idx, queue]);

  const next = () => (idx + 1 < queue.length ? setIdx(idx + 1) : onClose());
  const open = () => {
    window.open(buildWhatsAppLink(item.phone, msg), "_blank");
    onSent(item.key);
    next();
  };

  return (
    <Modal open onClose={onClose} title={`Send ${idx + 1} of ${queue.length}`} wide>
      <div className="flex flex-col gap-3">
        <div>
          <div className="font-semibold">{item.name}</div>
          <div className="text-xs text-muted">{item.phone}</div>
        </div>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={14}
          className="border border-line rounded-lg px-3 py-2 text-sm bg-white w-full outline-none focus:border-ink2 font-mono leading-relaxed" />
        <div className="flex gap-2 justify-end">
          {queue.length > 1 && <button onClick={next} className="px-4 py-2 rounded-lg text-sm font-semibold border border-line hover:bg-paper">Skip</button>}
          <button onClick={open} className="bg-loom text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"><MessageCircle size={15} /> Open WhatsApp{queue.length > 1 && idx + 1 < queue.length ? " & next" : ""}</button>
        </div>
      </div>
    </Modal>
  );
}

function LinkModal({ group, customers, link, onSave, onClose }) {
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState(() => customers.find((c) => c.id === link?.customerId) || null);
  const [phone, setPhone] = useState(link?.phone || "");
  const suggestions = customers
    .filter((c) => (c.name || "").toLowerCase().includes(q.toLowerCase()))
    .map((c) => ({ id: c.id, label: c.name, sublabel: [c.city, c.phone].filter(Boolean).join(" · "), c }));

  const save = () => {
    const effective = phone || customer?.phone || "";
    if (!customer && !phone) return onSave(null);
    onSave({
      ...(customer ? { customerId: customer.id } : {}),
      ...(phone && phone !== customer?.phone ? { phone } : {}),
      ...(effective ? {} : {}),
    });
  };

  return (
    <Modal open onClose={onClose} title={`Link — ${group.name}`}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wide">Customer in master</label>
          <div className="mt-1">
            <SearchDropdown query={q} onQueryChange={setQ} suggestions={suggestions} placeholder="Search customer…"
              onSelect={(s) => { setCustomer(s.c); setQ(""); if (!phone) setPhone(s.c.phone || ""); }} />
          </div>
          {customer && <div className="text-sm mt-2 font-medium text-loom">✓ {customer.name}</div>}
        </div>
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wide">WhatsApp number</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" inputMode="tel"
            className="mt-1 border border-line rounded-lg px-3 py-2 text-sm bg-white w-full outline-none focus:border-ink2" />
          <p className="text-xs text-muted mt-1">Saved for this party only — your master record isn't changed.</p>
        </div>
        <div className="flex gap-2 justify-end">
          {link && <button onClick={() => onSave(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-rust hover:bg-rust/10 mr-auto">Remove link</button>}
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border border-line hover:bg-paper">Cancel</button>
          <button onClick={save} className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold">Save</button>
        </div>
      </div>
    </Modal>
  );
}

function SettingsModal({ open, settings, onSave, onClose }) {
  const [creditDays, setCreditDays] = useState(settings.creditDays);
  const [footer, setFooter] = useState(settings.footer);
  useEffect(() => { if (open) { setCreditDays(settings.creditDays); setFooter(settings.footer); } }, [open, settings]);
  return (
    <Modal open={open} onClose={onClose} title="Outstanding settings">
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wide">Credit days (overdue after)</label>
          <input type="number" min={0} value={creditDays} onChange={(e) => setCreditDays(e.target.value)}
            className="mt-1 border border-line rounded-lg px-3 py-2 text-sm bg-white w-full outline-none focus:border-ink2" />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted uppercase tracking-wide">Message footer</label>
          <textarea value={footer} onChange={(e) => setFooter(e.target.value)} rows={3} placeholder="e.g. bank details / payment request"
            className="mt-1 border border-line rounded-lg px-3 py-2 text-sm bg-white w-full outline-none focus:border-ink2" />
          <button onClick={() => setFooter(DEFAULT_FOOTER)} className="text-xs text-ink2 font-semibold mt-1 hover:underline">Reset to default</button>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border border-line hover:bg-paper">Cancel</button>
          <button onClick={() => onSave({ creditDays: Math.max(0, Number(creditDays) || 0), footer })} className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold">Save</button>
        </div>
      </div>
    </Modal>
  );
}
