import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, MessageCircle, Phone, Search, Link2, Download, AlertTriangle,
  CheckCircle2, Wallet, Users, Clock, Settings2, FileText, Send, Share2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { useCustomers } from "../context/domains.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { pullState, pushState, isSetupError } from "../services/outstandingSync";
import Modal from "../components/Modal.jsx";
import KpiCard from "../components/KpiCard.jsx";
import SearchDropdown from "../components/SearchDropdown.jsx";
import { buildWhatsAppLink } from "../services/whatsapp";
import { buildPDF, formatCurrency, downloadBlob } from "../utils/helpers";
import {
  renderStatementCanvas, canvasToBlob, canvasToPdfBlob, statementCaption, statementFileName,
  shareStatementFile, downloadBlob as saveBlob,
} from "../utils/statementImage";
import {
  BUCKETS, bucketOf, fmtDate, groupParties, overdueAmount, matchParty, resolvePhone,
  buildStatementMessage, parseOutstandingFile, exportExcel,
  loadSnapshot, saveSnapshot, loadLinks, saveLinks, loadSent, saveSent,
  loadSettings, saveSettings, DEFAULT_FOOTER, compactINR, summaryMessage,
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
  const [detailKey, setDetailKey] = useState(null);
  const [stmtKey, setStmtKey] = useState(null);
  const [sync, setSync] = useState(isSupabaseConfigured ? "syncing" : "off");

  const pushCloud = (patch) => {
    if (!isSupabaseConfigured) return;
    setSync("syncing");
    pushState(patch).then(() => setSync("ok")).catch((e) => setSync(isSetupError(e) ? "setup" : "error"));
  };

  // Cloud is the source of truth; localStorage is just the instant cache.
  // First device to open this after setup uploads what it already has.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let dead = false;
    const pull = async () => {
      try {
        const remote = await pullState();
        if (dead) return;
        const local = loadSnapshot();
        const all = () => ({ snapshot: local, links: loadLinks(), sent: loadSent(), settings: loadSettings() });
        if (!remote) {
          if (local) await pushState(all());
          if (!dead) setSync("ok");
          return;
        }
        if (local && (local.uploadedAt || "") > (remote.snapshot?.uploadedAt || "")) {
          await pushState(all());
          if (!dead) setSync("ok");
          return;
        }
        if (remote.snapshot) { saveSnapshot(remote.snapshot); setSnap(remote.snapshot); }
        saveLinks(remote.links || {}); setLinks(remote.links || {});
        saveSent(remote.sent || {}); setSent(remote.sent || {});
        saveSettings(remote.settings || {}); setSettings(loadSettings());
        setSync("ok");
      } catch (e) {
        if (!dead) setSync(isSetupError(e) ? "setup" : "error");
      }
    };
    pull();
    const onVis = () => { if (document.visibilityState === "visible") pull(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { dead = true; document.removeEventListener("visibilitychange", onVis); };
  }, []);

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

  const shareSummary = async () => {
    const text = summaryMessage(rows, totals, snap.asOn, settings.creditDays);
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelled */ } return; }
    try { await navigator.clipboard.writeText(text); showToast("Summary copied"); } catch { showToast("Couldn't copy", "error"); }
  };

  // ---------- upload ----------
  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseOutstandingFile(file);
      if (!saveSnapshot(parsed)) showToast("Loaded, but couldn't be saved on this device (storage full).", "error");
      saveSent({}); setSent({});
      setSnap(parsed);
      pushCloud({ snapshot: parsed, sent: {} });
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
    setLinks(next); saveLinks(next); pushCloud({ links: next });
  };
  const markSent = (key) => {
    const next = { ...sent, [key]: new Date().toISOString() };
    setSent(next); saveSent(next); pushCloud({ sent: next });
  };
  const updateSettings = (s) => { setSettings(s); saveSettings(s); pushCloud({ settings: s }); };

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
        <div className="text-xs -mt-3"><SyncBadge sync={sync} /></div>
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
        <button onClick={shareSummary} className="p-2 rounded-lg border border-line hover:bg-paper" aria-label="Share summary"><Share2 size={16} /></button>
        <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg border border-line hover:bg-paper" aria-label="Settings"><Settings2 size={16} /></button>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink2 transition flex items-center gap-2 disabled:opacity-50">
          <Upload size={15} /> {busy ? "Reading…" : "Upload new"}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      </Header>

      <div className="text-xs text-muted -mt-3">As on <b className="text-ink">{fmtDate(snap.asOn)}</b> · {snap.fileName} · <SyncBadge sync={sync} /></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Net Outstanding" value={compactINR(totals.net)} icon={Wallet} sub={`${inr(totals.net)} · ${groups.length} parties`} />
        <KpiCard label={`Overdue > ${settings.creditDays}d`} value={compactINR(totals.overdue)} tone="rust" icon={AlertTriangle} sub={`${totals.due ? Math.round((totals.overdue / totals.due) * 100) : 0}% of dues`} />
        <KpiCard label="Advance / Credit" value={compactINR(totals.advance)} tone="loom" icon={CheckCircle2} sub="adjusted in net" />
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
        <StatementsTab onStatement={setStmtKey} onOpen={setDetailKey} rows={rows} sent={sent} settings={settings} snap={snap} startQueue={startQueue}
          onLink={setLinking} onConfirm={(r) => updateLink(r.g.key, { ...(r.link || {}), customerId: r.match.customer.id })}
          showToast={showToast} />
      )}
      {tab === "summary" && <SummaryTab rows={rows} totals={totals} snap={snap} onOpen={setDetailKey} />}
      {tab === "bills" && <BillsTab snap={snap} />}
      {tab === "priority" && <PriorityTab rows={rows} settings={settings} startQueue={startQueue} onOpen={setDetailKey} />}

      {detailKey && rows.find((r) => r.g.key === detailKey) && (
        <PartyDetail row={rows.find((r) => r.g.key === detailKey)} settings={settings} snap={snap}
          onClose={() => setDetailKey(null)}
          onStatement={(r) => { setDetailKey(null); setStmtKey(r.g.key); }}
          onSend={(r, o) => { setDetailKey(null); startQueue([r], o); }} />
      )}
      {stmtKey && rows.find((r) => r.g.key === stmtKey) && (
        <StatementModal row={rows.find((r) => r.g.key === stmtKey)} snap={snap} settings={settings} onClose={() => setStmtKey(null)} showToast={showToast} />
      )}
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

function SyncBadge({ sync }) {
  const m = {
    syncing: ["Syncing…", "text-muted"],
    ok: ["☁ Synced across devices", "text-loom"],
    off: ["Saved on this device only", "text-muted"],
    error: ["Sync failed — retry by reopening", "text-rust"],
    setup: ["Cloud sync not set up — run supabase/outstanding.sql", "text-thread"],
  }[sync];
  return <span className={`font-semibold ${m[1]}`}>{m[0]}</span>;
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
function StatementsTab({ onStatement, onOpen, rows, sent, settings, snap, startQueue, onLink, onConfirm, showToast }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(new Set());
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [showAgeing, setShowAgeing] = useState(false);
  const [sort, setSort] = useState("amount");

  const eligible = (r) => r.match.status === "auto" && r.phone && r.g.total > 0;
  const list0 = rows.filter((r) => {
    if (q && !r.g.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "pending") return r.g.total > 0 && !sent[r.g.key];
    if (filter === "link") return r.match.status !== "auto" || !r.phone;
    if (filter === "overdue") return r.overdue > 0;
    if (filter === "advance") return r.g.total < 0;
    return true;
  });
  const list = [...list0].sort((a, b) =>
    sort === "name" ? a.g.name.localeCompare(b.g.name) : sort === "oldest" ? b.g.oldest - a.g.oldest : sort === "overdue" ? b.overdue - a.overdue : b.g.total - a.g.total);
  const toggle = (key) => setSel((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const selectable = list.filter(eligible);
  const chosen = rows.filter((r) => sel.has(r.g.key) && eligible(r));
  const opts = { onlyOverdue, showAgeing };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search party…" className="border border-line rounded-lg pl-9 pr-3 py-2 text-sm bg-white w-full outline-none focus:border-ink2" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="border border-line rounded-lg px-2 py-2 text-xs font-semibold bg-white outline-none">
          <option value="amount">Sort: Amount</option><option value="overdue">Sort: Overdue</option><option value="oldest">Sort: Oldest bill</option><option value="name">Sort: Name</option>
        </select>
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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="font-semibold">Bill ageing:</span>
        {BUCKETS.map((b) => <span key={b.key} className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: b.color }} />{b.label}d</span>)}
        <span className="ml-auto">Bar length = bill amount</span>
      </div>

      <div className="flex flex-col gap-2">
        {list.map((r) => {
          const ok = eligible(r);
          return (
            <div key={r.g.key} className="bg-panel border border-line rounded-xl p-3 sm:p-4 flex items-center gap-3 flex-wrap">
              <input type="checkbox" disabled={!ok} checked={sel.has(r.g.key)} onChange={() => toggle(r.g.key)} className="w-4 h-4" />
              <div className="flex-1 min-w-[180px]">
                <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                  <button onClick={() => onOpen(r.g.key)} className="text-left hover:underline">{r.g.name}</button>
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
                <button disabled={r.g.bills.length === 0} onClick={() => onStatement(r.g.key)} className="p-2 rounded-lg border border-line hover:bg-paper disabled:opacity-30" aria-label="Statement PDF / Image"><FileText size={15} /></button>
                <button disabled={!ok} onClick={() => startQueue([r], opts)} className="p-2 rounded-lg bg-loom text-white disabled:opacity-30" aria-label="WhatsApp"><MessageCircle size={15} /></button>
              </div>
              <BillBars g={r.g} />
            </div>
          );
        })}
        {!list.length && <div className="text-center text-sm text-muted py-10">Nothing to show for this filter.</div>}
      </div>
    </div>
  );
}

// ---------------- Tab 2: ageing summary ----------------
function SummaryTab({ rows, totals, snap, onOpen }) {
  const [sort, setSort] = useState({ key: "total", dir: -1 });
  const data = BUCKETS.map((b) => ({ name: b.label, value: totals.buckets[b.key], color: b.color }));
  const dueSum = data.reduce((s, d) => s + d.value, 0) || 1;
  const val = (g, k) => (k === "name" ? g.name : k === "total" ? g.total : k === "advance" ? g.advance : g.buckets[k]);
  const sorted = [...rows].sort((a, b) => {
    const x = val(a.g, sort.key), y = val(b.g, sort.key);
    return (typeof x === "string" ? x.localeCompare(y) : x - y) * sort.dir;
  });
  const colMax = Object.fromEntries(BUCKETS.map((b) => [b.key, Math.max(1, ...rows.map((r) => r.g.buckets[b.key]))]));
  const heat = (v, b) => (v ? { background: `${b.color}${Math.round(18 + 50 * (v / colMax[b.key])).toString(16).padStart(2, "0")}` } : undefined);

  const exportRows = () => sorted.map(({ g }) => ({
    party: g.name, ...Object.fromEntries(BUCKETS.map((b) => [b.key, g.buckets[b.key]])), advance: g.advance ? -g.advance : 0, total: g.total,
  }));
  const cols = [{ key: "party", label: "Party" }, ...BUCKETS.map((b) => ({ key: b.key, label: `${b.label} days` })), { key: "advance", label: "Advance" }, { key: "total", label: "Net Total" }];
  const pdf = async () => {
    const fmt = exportRows().map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? formatCurrency(v) : v])));
    downloadBlob("Ageing_Summary.pdf", await buildPDF(`Ageing Summary as on ${fmtDate(snap.asOn)}`, fmt, cols));
  };
  const th = (key, label, color, cls = "text-right px-3") => (
    <th onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))} style={color ? { color } : undefined}
      className={`${cls} py-3 cursor-pointer select-none whitespace-nowrap`}>{label}{sort.key === key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}</th>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-panel border border-line rounded-2xl p-4">
        <div className="text-xs font-medium text-muted uppercase tracking-wide mb-3">Outstanding by ageing</div>
        <div className="flex h-3 rounded-full overflow-hidden bg-paper">
          {data.map((d) => d.value > 0 && <div key={d.name} style={{ width: `${(d.value / dueSum) * 100}%`, background: d.color }} />)}
        </div>
        <div className="grid grid-cols-5 gap-1 mt-3">
          {data.map((d) => (
            <div key={d.name} className="text-center">
              <div className="text-[10px] font-semibold" style={{ color: d.color }}>{d.name}</div>
              <div className="text-xs font-bold">{compactINR(d.value, false)}</div>
              <div className="text-[10px] text-muted">{Math.round((d.value / dueSum) * 100)}%</div>
            </div>
          ))}
        </div>
        <div className="h-44 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 18 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v) => inr(v)} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
                <LabelList dataKey="value" position="top" formatter={(v) => compactINR(v, false)} style={{ fontSize: 11, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ExportBar onExcel={() => exportExcel(`Ageing_Summary_${snap.asOn}.xlsx`, "Ageing Summary", exportRows(), cols)} onPdf={pdf} />
      <div className="bg-panel border border-line rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-xs text-muted uppercase tracking-wide border-b border-line">
              {th("name", "Party", null, "text-left px-3 sticky left-0 bg-panel z-10")}
              {BUCKETS.map((b) => th(b.key, b.label, b.color))}
              {th("advance", "Adv")}
              {th("total", "Net", null, "text-right px-4")}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ g }) => (
              <tr key={g.key} onClick={() => onOpen(g.key)} className="border-b border-line last:border-0 cursor-pointer hover:bg-paper/60">
                <td className="px-3 py-2.5 font-medium sticky left-0 bg-panel z-10 max-w-[150px] truncate">{g.name}</td>
                {BUCKETS.map((b) => (
                  <td key={b.key} style={heat(g.buckets[b.key], b)} title={g.buckets[b.key] ? inr(g.buckets[b.key]) : ""}
                    className={`text-right px-3 whitespace-nowrap ${g.buckets[b.key] ? "" : "text-muted/40"}`}>{g.buckets[b.key] ? compactINR(g.buckets[b.key], false) : "–"}</td>
                ))}
                <td className="text-right px-3 text-loom whitespace-nowrap">{g.advance ? `-${compactINR(g.advance, false)}` : "–"}</td>
                <td className="text-right px-4 font-semibold whitespace-nowrap">{compactINR(g.total, false)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t-2 border-line bg-paper/60">
              <td className="px-3 py-3 sticky left-0 bg-paper z-10">Total</td>
              {BUCKETS.map((b) => <td key={b.key} className="text-right px-3 whitespace-nowrap">{compactINR(totals.buckets[b.key], false)}</td>)}
              <td className="text-right px-3 text-loom whitespace-nowrap">-{compactINR(totals.advance, false)}</td>
              <td className="text-right px-4 whitespace-nowrap">{compactINR(totals.net, false)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-muted text-center">Amounts in ₹ (L = lakh, Cr = crore). Tap a party for bill details.</p>
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
function PriorityTab({ rows, settings, startQueue, onOpen }) {
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
              <button onClick={() => onOpen(r.g.key)} className="font-semibold text-sm text-left hover:underline">{r.g.name}</button>
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

function BillBars({ g, limit = 3 }) {
  const [all, setAll] = useState(false);
  const bills = [...g.bills].sort((a, b) => a.date.localeCompare(b.date));
  if (!bills.length) return null;
  const max = Math.max(1, ...bills.map((b) => Math.abs(b.outstanding)));
  const shown = all ? bills : bills.slice(0, limit);
  return (
    <div className="basis-full w-full flex flex-col gap-1.5 pt-2 border-t border-line/70">
      {shown.map((b, i) => {
        const neg = b.outstanding < 0;
        const color = neg ? "#2F6E5D" : bucketOf(b.days).color;
        return (
          <div key={i} className="flex items-center gap-2 text-[11px]" title={`${neg ? "Advance" : "Bill " + b.billNo} · ${fmtDate(b.date)} · ${inr(b.outstanding)}`}>
            <div className="w-[84px] shrink-0 leading-tight">
              <div className="font-semibold truncate">{neg ? "Advance" : b.billNo}</div>
              <div className="text-muted">{fmtDate(b.date).replace(/-(\d{2})(\d{2})$/, "-$2")}</div>
            </div>
            <div className="flex-1 h-3 rounded-full bg-paper overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.max(5, (Math.abs(b.outstanding) / max) * 100)}%`, background: color }} />
            </div>
            <div className={`w-[70px] text-right font-semibold ${neg ? "text-loom" : ""}`}>{compactINR(b.outstanding)}</div>
            <div className="w-[44px] text-center">{neg ? <span className="text-loom font-semibold">Adv</span> : <DaysBadge days={b.days} />}</div>
          </div>
        );
      })}
      {bills.length > limit && (
        <button onClick={() => setAll(!all)} className="text-[11px] font-semibold text-ink2 text-left hover:underline">
          {all ? "Show fewer" : `Show all ${bills.length} bills`}
        </button>
      )}
    </div>
  );
}

function StatementModal({ row, snap, settings, onClose, showToast }) {
  const { g } = row;
  const [files, setFiles] = useState(null);
  useEffect(() => {
    let url;
    let dead = false;
    (async () => {
      try {
        const canvas = renderStatementCanvas(g, snap.asOn, { creditDays: settings.creditDays, footer: settings.footer });
        const [png, pdf] = await Promise.all([canvasToBlob(canvas), canvasToPdfBlob(canvas)]);
        url = URL.createObjectURL(png);
        if (!dead) setFiles({ png, pdf, url });
      } catch (e) {
        showToast("Couldn't build the statement.", "error");
      }
    })();
    return () => { dead = true; if (url) URL.revokeObjectURL(url); };
  }, [g, snap.asOn, settings.creditDays, settings.footer]);

  const caption = statementCaption(g, snap.asOn);
  const send = async (kind) => {
    const blob = kind === "png" ? files.png : files.pdf;
    const res = await shareStatementFile(blob, statementFileName(g, kind), row.phone, caption);
    if (res === "downloaded") showToast(row.phone ? "Saved — attach it in the WhatsApp chat that opened" : "Saved to your device", "info");
  };
  const btn = "px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40";

  return (
    <Modal open onClose={onClose} title={`Statement — ${g.name}`} wide>
      <div className="flex flex-col gap-3">
        <div className="border border-line rounded-xl bg-paper overflow-auto max-h-[58vh]">
          {files ? <img src={files.url} alt="Statement preview" className="w-full block" /> : <div className="py-16 text-center text-sm text-muted">Preparing statement…</div>}
        </div>
        {!row.phone && <p className="text-xs text-thread font-semibold">No phone linked — you can still share via the share sheet or download.</p>}
        <div className="grid grid-cols-2 gap-2">
          <button disabled={!files} onClick={() => send("png")} className={`${btn} bg-loom text-white`}><MessageCircle size={15} /> WhatsApp · Image</button>
          <button disabled={!files} onClick={() => send("pdf")} className={`${btn} bg-loom text-white`}><MessageCircle size={15} /> WhatsApp · PDF</button>
          <button disabled={!files} onClick={() => saveBlob(statementFileName(g, "png"), files.png)} className={`${btn} border border-line hover:bg-paper`}><Download size={15} /> Save Image</button>
          <button disabled={!files} onClick={() => saveBlob(statementFileName(g, "pdf"), files.pdf)} className={`${btn} border border-line hover:bg-paper`}><Download size={15} /> Save PDF</button>
        </div>
      </div>
    </Modal>
  );
}

function AgeBar({ g, className = "" }) {
  if (!g.due) return null;
  return (
    <div className={`flex h-1.5 rounded-full overflow-hidden bg-paper ${className}`}>
      {BUCKETS.map((b) => g.buckets[b.key] > 0 && (
        <div key={b.key} title={`${b.label}d: ${inr(g.buckets[b.key])}`} style={{ width: `${(g.buckets[b.key] / g.due) * 100}%`, background: b.color }} />
      ))}
    </div>
  );
}

function PartyDetail({ row, settings, snap, onClose, onSend, onStatement }) {
  const { g } = row;
  const canSend = row.match.status === "auto" && row.phone && g.total > 0;
  const bills = [...g.bills].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Modal open onClose={onClose} title={g.name} wide>
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-muted">Net outstanding · as on {fmtDate(snap.asOn)}</div>
            <div className={`font-display font-extrabold text-2xl ${g.total < 0 ? "text-loom" : ""}`}>{inr(g.total)}</div>
            {g.advance > 0 && <div className="text-xs text-loom">incl. advance {inr(g.advance)}</div>}
          </div>
          <div className="text-xs text-muted text-right">{row.phone || "No phone"}{row.overdue > 0 && <div className="text-rust font-semibold">{inr(row.overdue)} overdue &gt; {settings.creditDays}d</div>}</div>
        </div>
        <AgeBar g={g} />
        <div className="flex flex-wrap gap-1.5">
          {BUCKETS.filter((b) => g.buckets[b.key] > 0).map((b) => (
            <span key={b.key} className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: `${b.color}1F`, color: b.color }}>{b.label}d · {compactINR(g.buckets[b.key])}</span>
          ))}
        </div>
        <div className="border border-line rounded-xl overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-sm min-w-[360px]">
            <thead><tr className="text-xs text-muted uppercase tracking-wide border-b border-line"><th className="text-left px-3 py-2">Bill</th><th className="text-left px-3">Date</th><th className="text-right px-3">Outstanding</th><th className="text-right px-3">Days</th></tr></thead>
            <tbody>
              {bills.map((b, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-medium">{b.billNo}</td>
                  <td className="px-3 whitespace-nowrap">{fmtDate(b.date)}</td>
                  <td className={`px-3 text-right font-semibold ${b.outstanding < 0 ? "text-loom" : ""}`}>{formatCurrency(b.outstanding)}</td>
                  <td className="px-3 text-right">{b.outstanding > 0 ? <DaysBadge days={b.days} /> : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 justify-end flex-wrap">
          {row.phone && <a href={`tel:${row.phone}`} className="px-4 py-2 rounded-lg text-sm font-semibold border border-line hover:bg-paper flex items-center gap-2"><Phone size={14} /> Call</a>}
          <button onClick={() => onStatement(row)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-line hover:bg-paper flex items-center gap-2"><FileText size={14} /> Statement (PDF / Image)</button>
          {row.overdue > 0 && <button disabled={!canSend} onClick={() => onSend(row, { onlyOverdue: true })} className="px-4 py-2 rounded-lg text-sm font-semibold border border-line hover:bg-paper disabled:opacity-40">Overdue only</button>}
          <button disabled={!canSend} onClick={() => onSend(row, {})} className="bg-loom text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-40"><MessageCircle size={14} /> WhatsApp statement</button>
        </div>
      </div>
    </Modal>
  );
}

function ExportBar({ onExcel, onPdf }) {
  const showToast = useToast();
  const run = (fn) => async () => {
    try { await fn(); } catch (e) { showToast("Export failed — please try again.", "error"); }
  };
  return (
    <div className="flex gap-2 justify-end">
      <button onClick={run(onExcel)} className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold hover:bg-paper flex items-center gap-1.5"><Download size={13} /> Excel</button>
      <button onClick={run(onPdf)} className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold hover:bg-paper flex items-center gap-1.5"><Download size={13} /> PDF</button>
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
