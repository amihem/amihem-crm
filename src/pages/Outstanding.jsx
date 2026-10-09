import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, MessageCircle, Phone, Search, Link2, Download, AlertTriangle,
  CheckCircle2, Wallet, Users, Clock, Settings2, FileText, Send, Share2,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { useCustomers } from "../context/domains.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { pullState, pushState, isSetupError, uploadStatement } from "../services/outstandingSync";
import Modal from "../components/Modal.jsx";
import { SummaryTab, BillsTab, MonthTab, PriorityTab } from "./outstandingReports.jsx";
import KpiCard from "../components/KpiCard.jsx";
import SearchDropdown from "../components/SearchDropdown.jsx";
import { buildWhatsAppLink } from "../services/whatsapp";
import { buildPDF, formatCurrency, downloadBlob } from "../utils/helpers";
import { buildLedgerPages, ledgerPdfBlob, ledgerPageCanvas } from "../utils/ledgerPdf";
import { RANJAN_LOGO } from "../assets/ranjanLogo";
import {
  renderStatementCanvas, canvasToBlob, canvasToPdfBlob, statementCaption, statementFileName,
  shareStatementFile, downloadBlob as saveBlob,
} from "../utils/statementImage";
import {
  BUCKETS, bucketOf, fmtDate, groupParties, overdueAmount, matchParty, resolvePhone,
  buildStatementMessage, parseOutstandingFile, diffDays, exportExcel,
  loadSnapshot, saveSnapshot, loadLinks, saveLinks, loadSent, saveSent,
  loadSettings, saveSettings, DEFAULT_FOOTER, compactINR, summaryMessage, SOURCES, companyFor,
} from "../utils/outstanding";

const inr = (n) => `₹${formatCurrency(n)}`;
const TABS = [
  { id: "statements", label: "Statements · WhatsApp" },
  { id: "summary", label: "Ageing Summary" },
  { id: "bills", label: "Bill-wise Ageing" },
  { id: "month", label: "Month-wise" },
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
  const [source, setSource] = useState(() => {
    try { return localStorage.getItem("amihem_crm_outstanding_source") || "navkar"; } catch { return "navkar"; }
  });
  const pick = (id) => {
    setSource(id);
    try { localStorage.setItem("amihem_crm_outstanding_source", id); } catch { /* ignore */ }
  };
  const [, bump] = useState(0);
  const stat = (id) => {
    const sn = loadSnapshot(id);
    return sn ? { net: sn.bills.reduce((t, x) => t + x.outstanding, 0), asOn: sn.asOn } : null;
  };
  const bar = (
    <div className="grid grid-cols-2 gap-2">
      {SOURCES.map((c) => {
        const st = stat(c.id);
        const on = source === c.id;
        return (
          <button key={c.id} onClick={() => pick(c.id)}
            className={`text-left rounded-xl border-2 px-4 py-3 transition ${on ? "border-ink bg-ink text-white" : "border-line bg-panel hover:border-ink2/40"}`}>
            <div className="text-sm font-bold">{c.label}</div>
            <div className={`text-xs mt-0.5 ${on ? "text-white/70" : "text-muted"}`}>
              {st ? `${compactINR(st.net)} · ${fmtDate(st.asOn)}` : "No report yet"}
            </div>
          </button>
        );
      })}
    </div>
  );
  return <OutstandingSource key={source} source={source} sourceBar={bar} onUpdate={() => bump((n) => n + 1)} />;
}

function OutstandingSource({ source, sourceBar, onUpdate }) {
  const cfg = SOURCES.find((c) => c.id === source) || SOURCES[0];
  const { items: customers } = useCustomers();
  const showToast = useToast();
  const fileRef = useRef(null);

  const [snapRaw, setSnap] = useState(() => loadSnapshot(source));
  const [asOnPick, setAsOnPick] = useState(null); // back-dated view (null = report date)
  // Back-dated view: bills after the chosen date are dropped and ageing is recounted
  // from that date. Amounts stay as per the uploaded report (later payments are not undone).
  const backdated = !!(snapRaw && asOnPick && asOnPick < snapRaw.asOn);
  const snap = useMemo(() => {
    if (!snapRaw || !backdated) return snapRaw;
    return {
      ...snapRaw,
      asOn: asOnPick,
      bills: snapRaw.bills.filter((b) => b.date <= asOnPick).map((b) => ({ ...b, days: Math.max(0, diffDays(asOnPick, b.date)) })),
    };
  }, [snapRaw, asOnPick, backdated]);
  const [links, setLinks] = useState(() => loadLinks(source));
  const [sent, setSent] = useState(() => loadSent(source));
  const [settings, setSettings] = useState(() => loadSettings(source));
  const [tab, setTab] = useState("statements");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [queue, setQueue] = useState(null); // [{key,name,phone,message}]
  const [linking, setLinking] = useState(null); // group being linked
  const [showSettings, setShowSettings] = useState(false);
  const [detailKey, setDetailKey] = useState(null);
  const [stmtKey, setStmtKey] = useState(null);
  const company = companyFor(source, snap);
  const [sync, setSync] = useState(isSupabaseConfigured ? "syncing" : "off");

  const pushCloud = (patch) => {
    if (!isSupabaseConfigured) return;
    setSync("syncing");
    pushState(source, patch).then(() => setSync("ok")).catch((e) => setSync(isSetupError(e) ? "setup" : "error"));
  };

  // Cloud is the source of truth; localStorage is just the instant cache.
  // First device to open this after setup uploads what it already has.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let dead = false;
    const pull = async () => {
      try {
        const remote = await pullState(source);
        if (dead) return;
        const local = loadSnapshot(source);
        const all = () => ({ snapshot: local, links: loadLinks(source), sent: loadSent(source), settings: loadSettings(source) });
        if (!remote) {
          if (local) await pushState(source, all());
          if (!dead) setSync("ok");
          return;
        }
        if (local && (local.uploadedAt || "") > (remote.snapshot?.uploadedAt || "")) {
          await pushState(source, all());
          if (!dead) setSync("ok");
          return;
        }
        if (remote.snapshot) { saveSnapshot(remote.snapshot, source); setSnap(remote.snapshot); onUpdate?.(); }
        saveLinks(remote.links || {}, source); setLinks(remote.links || {});
        saveSent(remote.sent || {}, source); setSent(remote.sent || {});
        saveSettings(remote.settings || {}, source); setSettings(loadSettings(source));
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
    const text = summaryMessage(rows, totals, snap.asOn, settings.creditDays, company);
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelled */ } return; }
    try { await navigator.clipboard.writeText(text); showToast("Summary copied"); } catch { showToast("Couldn't copy", "error"); }
  };

  // ---------- upload ----------
  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseOutstandingFile(file, source);
      if (!saveSnapshot(parsed, source)) showToast("Loaded, but couldn't be saved on this device (storage full).", "error");
      saveSent({}, source); setSent({});
      setSnap(parsed);
      onUpdate?.();
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
    setLinks(next); saveLinks(next, source); pushCloud({ links: next });
  };
  const markSent = (key) => {
    const next = { ...sent, [key]: new Date().toISOString() };
    setSent(next); saveSent(next, source); pushCloud({ sent: next });
  };
  const updateSettings = (s) => { setSettings(s); saveSettings(s, source); pushCloud({ settings: s }); };

  const lockMsg = () => showToast("Back-dated view is for viewing only — set the date back to the report date to send statements.", "info");
  const startQueue = (list, opts) => {
    if (backdated) { lockMsg(); return; }
    const items = list
      .filter((r) => r.phone)
      .map((r) => ({
        key: r.g.key, name: r.g.name, phone: r.phone,
        message: buildStatementMessage(r.g, snap.asOn, { creditDays: settings.creditDays, footer: settings.footer, company, ...opts }),
      }));
    if (!items.length) { showToast("No phone number available for the selected parties.", "error"); return; }
    if (items.length < list.length) showToast(`${list.length - items.length} skipped — no phone number.`, "info");
    setQueue(items);
  };

  // ---------- empty state ----------
  if (!snap) {
    return (
      <div className="flex flex-col gap-5">
        {sourceBar}
        <Header />
        <div className="text-xs -mt-3"><SyncBadge sync={sync} /></div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
          className={`border-2 border-dashed rounded-2xl p-10 sm:p-16 text-center bg-panel transition ${drag ? "border-ink2 bg-ink2/5" : "border-line"}`}
        >
          <div className="w-14 h-14 rounded-2xl bg-ink/10 text-ink flex items-center justify-center mx-auto mb-4"><Upload size={26} /></div>
          <h2 className="font-display font-bold text-lg">Upload {cfg.label} outstanding</h2>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            {cfg.hint}
          </p>
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="mt-5 bg-ink text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-ink2 transition disabled:opacity-50">
            {busy ? "Reading…" : "Choose file"}
          </button>
          <input ref={fileRef} type="file" accept={cfg.accept} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>
      </div>
    );
  }

  const unmatched = rows.filter((r) => r.match.status !== "auto" && r.g.total > 0).length;

  return (
    <div className="flex flex-col gap-5">
      {sourceBar}
      <Header>
        <button onClick={shareSummary} className="p-2 rounded-lg border border-line hover:bg-paper" aria-label="Share summary"><Share2 size={16} /></button>
        <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg border border-line hover:bg-paper" aria-label="Settings"><Settings2 size={16} /></button>
        <button onClick={() => fileRef.current?.click()} disabled={busy} className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink2 transition flex items-center gap-2 disabled:opacity-50">
          <Upload size={15} /> {busy ? "Reading…" : "Upload new"}
        </button>
        <input ref={fileRef} type="file" accept={cfg.accept} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      </Header>

      <div className="text-xs text-muted -mt-3 flex items-center gap-x-2 gap-y-1 flex-wrap">
        <span>As on</span>
        <input type="date" value={snap.asOn} max={snapRaw.asOn} onChange={(e) => setAsOnPick(e.target.value && e.target.value < snapRaw.asOn ? e.target.value : null)}
          className="border border-line rounded-md px-2 py-1 text-xs font-bold text-ink bg-white" aria-label="As on date" />
        {backdated && <button onClick={() => setAsOnPick(null)} className="font-semibold text-ink2 underline">Latest ({fmtDate(snapRaw.asOn)})</button>}
        <span>· {snapRaw.fileName} ·</span> <SyncBadge sync={sync} />
      </div>
      {backdated && (
        <div className="bg-thread/10 border border-thread/30 text-thread rounded-xl px-3 py-2 text-xs font-semibold -mt-2">
          Back-dated view as on {fmtDate(asOnPick)} — ageing recounted and later bills hidden. Payments received after this date are not added back, so totals are an estimate. Sending is switched off.
        </div>
      )}

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
        <StatementsTab onStatement={(k) => (backdated ? lockMsg() : setStmtKey(k))} onOpen={setDetailKey} rows={rows} sent={sent} settings={settings} snap={snap} startQueue={startQueue}
          onLink={setLinking} onConfirm={(r) => updateLink(r.g.key, { ...(r.link || {}), customerId: r.match.customer.id })}
          showToast={showToast} />
      )}
      {tab === "summary" && <SummaryTab rows={rows} totals={totals} snap={snap} settings={settings} company={company} onOpen={setDetailKey} />}
      {tab === "bills" && <BillsTab snap={snap} settings={settings} company={company} />}
      {tab === "month" && <MonthTab snap={snap} settings={settings} company={company} />}
      {tab === "priority" && <PriorityTab rows={rows} settings={settings} snap={snap} company={company} startQueue={startQueue} onOpen={setDetailKey} />}

      {detailKey && rows.find((r) => r.g.key === detailKey) && (
        <PartyDetail row={rows.find((r) => r.g.key === detailKey)} settings={settings} snap={snap}
          onClose={() => setDetailKey(null)}
          onStatement={(r) => { if (backdated) { lockMsg(); return; } setDetailKey(null); setStmtKey(r.g.key); }}
          onSend={(r, o) => { setDetailKey(null); startQueue([r], o); }} />
      )}
      {stmtKey && rows.find((r) => r.g.key === stmtKey) && (
        <StatementModal company={company} source={source} row={rows.find((r) => r.g.key === stmtKey)} snap={snap} settings={settings} onClose={() => setStmtKey(null)} showToast={showToast} />
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
            <div key={r.g.key} className="bg-panel border border-line rounded-xl p-3 sm:p-4 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-2.5 items-start">
              <input type="checkbox" disabled={!ok} checked={sel.has(r.g.key)} onChange={() => toggle(r.g.key)} className="w-4 h-4 mt-1" />
              <div className="min-w-0">
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
              <div className="text-right shrink-0">
                <div className={`font-display font-bold text-base whitespace-nowrap ${r.g.total < 0 ? "text-loom" : ""}`}>{inr(r.g.total)}</div>
                {r.g.due > 0 && <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted">oldest <DaysBadge days={r.g.oldest} /></div>}
              </div>
              <div className="col-span-3 flex items-center justify-end gap-1.5">
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

function BillBars({ g, limit = 3 }) {
  const [all, setAll] = useState(false);
  const bills = [...g.bills].sort((a, b) => a.date.localeCompare(b.date));
  if (!bills.length) return null;
  const max = Math.max(1, ...bills.map((b) => Math.abs(b.outstanding)));
  const shown = all ? bills : bills.slice(0, limit);
  return (
    <div className="col-span-3 basis-full w-full flex flex-col gap-2 pt-2 border-t border-line/70">
      {shown.map((b, i) => {
        const neg = b.outstanding < 0;
        const color = neg ? "#2F6E5D" : bucketOf(b.days).color;
        const part = !neg && b.credit > 0 && b.amount > 0;
        return (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <div className="w-[82px] shrink-0 leading-tight">
              <div className="font-semibold truncate">{neg ? (b.billNo && !/advance/i.test(b.billNo) ? b.billNo : "Advance") : b.billNo}</div>
              <div className="text-muted">{fmtDate(b.date).replace(/-(\d{2})(\d{2})$/, "-$2")}</div>
            </div>
            <div className="w-16 sm:w-24 h-2.5 rounded-full bg-paper overflow-hidden shrink-0">
              <div className="h-full rounded-full" style={{ width: `${Math.max(8, (Math.abs(b.outstanding) / max) * 100)}%`, background: color }} />
            </div>
            <div className="flex-1 text-right leading-tight min-w-0">
              <div className={`font-bold text-xs ${neg ? "text-loom" : ""}`}>{neg ? "-" : ""}{inr(Math.abs(b.outstanding))}</div>
              {part && <div className="text-[10px] text-muted truncate">of {inr(b.amount)}</div>}
            </div>
            <div className="w-[42px] text-center shrink-0">{neg ? <span className="text-loom font-semibold">Adv</span> : <DaysBadge days={b.days} />}</div>
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

function StatementModal({ company, source, row, snap, settings, onClose, showToast }) {
  const { g } = row;
  const ranjan = source === "ranjan";
  const [fmt, setFmt] = useState(ranjan ? "ledger" : "card");
  const [files, setFiles] = useState(null);
  useEffect(() => {
    let urls = [];
    let dead = false;
    (async () => {
      try {
        const card = renderStatementCanvas(g, snap.asOn, { creditDays: settings.creditDays, footer: settings.footer, company });
        const logo = ranjan ? RANJAN_LOGO : null;
        const pages = buildLedgerPages(g, snap, { format: ranjan ? "ranjan" : "generic", company, logo: !!logo });
        const [cardPng, cardPdf, ledPdf, ledCanvas] = await Promise.all([
          canvasToBlob(card), canvasToPdfBlob(card), ledgerPdfBlob(pages, logo), ledgerPageCanvas(pages[0], logo, 2.2, pages.length === 1),
        ]);
        const ledPng = await canvasToBlob(ledCanvas);
        const set = { card: { png: cardPng, pdf: cardPdf }, ledger: { png: ledPng, pdf: ledPdf } };
        Object.values(set).forEach((x) => { x.url = URL.createObjectURL(x.png); urls.push(x.url); });
        if (!dead) setFiles(set);
      } catch (e) {
        showToast("Couldn't build the statement.", "error");
      }
    })();
    return () => { dead = true; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [g, snap, settings.creditDays, settings.footer, company, ranjan]);

  const cur = files?.[fmt];
  const caption = statementCaption(g, snap.asOn, company);
  const base = (kind) => statementFileName(g, kind).replace("Statement_", fmt === "ledger" ? "Outstanding_" : "Statement_");
  const [busy, setBusy] = useState(false);
  // Share-sheet route: the file itself is attached, but WhatsApp asks you to pick the chat.
  const send = async (kind) => {
    const res = await shareStatementFile(cur[kind], base(kind), row.phone, caption);
    if (res === "downloaded") showToast(row.phone ? "Saved — attach it in the WhatsApp chat that opened" : "Saved to your device", "info");
  };
  // Link route: file is stored online and the customer's own chat opens with the link in the message.
  const sendLink = async (kind) => {
    if (!row.phone) { showToast("No phone number linked for this customer.", "error"); return; }
    setBusy(true);
    try {
      const url = await uploadStatement(cur[kind], base(kind));
      const text = `${caption}\n\n${kind === "pdf" ? "Statement (PDF)" : "Statement (Image)"}: ${url}`;
      const link = buildWhatsAppLink(row.phone, text);
      if (!window.open(link, "_blank")) window.location.href = link;
    } catch (e) {
      showToast("Couldn't create the link — run supabase/outstanding.sql once, then retry.", "error");
    } finally {
      setBusy(false);
    }
  };
  const btn = "px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40";
  const tab = (id, label) => (
    <button key={id} onClick={() => setFmt(id)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition ${fmt === id ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>{label}</button>
  );

  return (
    <Modal open onClose={onClose} title={`Statement — ${g.name}`} wide>
      <div className="flex flex-col gap-3">
        <div className="flex gap-1 p-1 bg-paper border border-line rounded-xl">
          {tab("ledger", ranjan ? "Ranjan ledger format" : "Ledger format")}
          {tab("card", "Summary card")}
        </div>
        <div className="border border-line rounded-xl bg-paper overflow-auto max-h-[56vh]">
          {cur ? <img src={cur.url} alt="Statement preview" className="w-full block" /> : <div className="py-16 text-center text-sm text-muted">Preparing statement…</div>}
        </div>
        {!row.phone && <p className="text-xs text-thread font-semibold">No phone linked — you can still share via the share sheet or download.</p>}
        <div className="grid grid-cols-2 gap-2">
          <button disabled={!cur || busy || !row.phone} onClick={() => sendLink("pdf")} className={`${btn} bg-loom text-white`}><MessageCircle size={15} /> {busy ? "Preparing…" : "Send PDF"}</button>
          <button disabled={!cur || busy || !row.phone} onClick={() => sendLink("png")} className={`${btn} bg-loom text-white`}><MessageCircle size={15} /> {busy ? "Preparing…" : "Send Image"}</button>
          <button disabled={!cur} onClick={() => saveBlob(base("pdf"), cur.pdf)} className={`${btn} border border-line hover:bg-paper`}><Download size={15} /> Save PDF</button>
          <button disabled={!cur} onClick={() => saveBlob(base("png"), cur.png)} className={`${btn} border border-line hover:bg-paper`}><Download size={15} /> Save Image</button>
        </div>
        <p className="text-[11px] text-muted leading-snug">
          “Send” opens the customer's own WhatsApp chat{row.phone ? ` (${row.phone})` : ""} with a link to the {fmt === "ledger" ? "ledger" : "statement"} in the message.
          Prefer to attach the file itself?{" "}
          <button onClick={() => send("pdf")} className="font-semibold text-ink2 underline">Share PDF</button> ·{" "}
          <button onClick={() => send("png")} className="font-semibold text-ink2 underline">Share Image</button>
        </p>
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
