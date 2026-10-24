// outstandingReports.jsx — the report tabs of the Outstanding page
// (Ageing Summary, Bill-wise Ageing, Month-wise, Collection Priority).
// Each has an on-screen view plus a branded PDF and an Excel export.

import { useMemo, useState } from "react";
import { Search, Download, Phone, MessageCircle, Clock, AlertTriangle, Hourglass, Trophy, Percent, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { useToast } from "../context/ToastContext.jsx";
import { formatCurrency, downloadBlob } from "../utils/helpers";
import { BUCKETS, bucketOf, fmtDate, compactINR, exportExcel, summarizeSnapshot, riskOf, fyStartYear, fyLabel } from "../utils/outstanding";
import { buildReportPdf } from "../utils/reportPdf";

const inr = (n) => `₹${formatCurrency(n)}`;
const money = (n) => (n ? formatCurrency(n) : "–");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BUCKET_COLORS = Object.fromEntries(BUCKETS.map((b, i) => [i, b.color]));

export function DaysBadge({ days }) {
  const b = bucketOf(days);
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: `${b.color}1F`, color: b.color }}>{days}d</span>;
}

export function RiskBadge({ level }) {
  const c = level === "High" ? ["#B4453A", "#B4453A1F"] : level === "Medium" ? ["#C9862D", "#C9862D1F"] : ["#2F6E5D", "#2F6E5D1F"];
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: c[0], background: c[1] }}>{level} risk</span>;
}

export function Stat({ icon: Icon, label, value, sub, tone = "text-ink" }) {
  return (
    <div className="bg-panel border border-line rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted uppercase tracking-wide"><Icon size={13} />{label}</div>
      <div className={`font-display font-bold text-lg mt-1 ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export function ReportBar({ title, note, onExcel, onPdf }) {
  const showToast = useToast();
  const run = (fn) => async () => { try { await fn(); } catch { showToast("Export failed — please try again.", "error"); } };
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h3 className="font-display font-bold text-base">{title}</h3>
        {note && <p className="text-xs text-muted mt-0.5">{note}</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={run(onExcel)} className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold hover:bg-paper flex items-center gap-1.5"><Download size={13} /> Excel</button>
        <button onClick={run(onPdf)} className="px-3 py-1.5 rounded-lg bg-ink text-white text-xs font-semibold hover:bg-ink2 flex items-center gap-1.5"><Download size={13} /> PDF</button>
      </div>
    </div>
  );
}

export const savePdf = async (file, opts) => downloadBlob(file, await buildReportPdf(opts));

function weightedAge(bills) {
  let w = 0, t = 0;
  bills.forEach((b) => { if (b.outstanding > 0) { w += b.outstanding * b.days; t += b.outstanding; } });
  return t ? Math.round(w / t) : 0;
}

// ======================= Ageing Summary =======================
export function SummaryTab({ rows, totals, snap, settings, company, filterNote, onOpen }) {
  const [sort, setSort] = useState({ key: "total", dir: -1 });
  const [bk, setBk] = useState(null); // clicked ageing bucket
  const dueSum = BUCKETS.reduce((s, b) => s + totals.buckets[b.key], 0) || 1;
  const posBills = snap.bills.filter((b) => b.outstanding > 0);
  const oldest = posBills.reduce((m, b) => (b.days > (m?.days ?? -1) ? b : m), null);
  const atRisk = posBills.filter((b) => b.days > 180).reduce((t, b) => t + b.outstanding, 0);
  const top5 = [...rows].sort((a, b) => b.g.due - a.g.due).slice(0, 5).reduce((s, r) => s + r.g.due, 0);
  const val = (g, k) => (k === "name" ? g.name : k === "total" ? g.total : k === "advance" ? g.advance : k === "oldest" ? g.oldest : g.buckets[k]);
  const sorted = [...rows].sort((a, b) => {
    const x = val(a.g, sort.key), y = val(b.g, sort.key);
    return (typeof x === "string" ? x.localeCompare(y) : x - y) * sort.dir;
  });
  const shownRows = bk ? sorted.filter((r) => r.g.buckets[bk] > 0).sort((a, b) => (sort.key === "total" ? b.g.buckets[bk] - a.g.buckets[bk] : 0)) : sorted;
  const top10 = [...rows].filter((r) => r.g.due > 0).sort((a, b) => b.g.due - a.g.due).slice(0, 10);
  const top10Max = Math.max(1, ...top10.map((r) => r.g.due));
  const colMax = Object.fromEntries(BUCKETS.map((b) => [b.key, Math.max(1, ...rows.map((r) => r.g.buckets[b.key]))]));
  const heat = (v, b) => (v ? { background: `${b.color}${Math.round(16 + 48 * (v / colMax[b.key])).toString(16).padStart(2, "0")}` } : undefined);

  const head = ["#", "Party", ...BUCKETS.map((b) => `${b.label} days`), "Advance", "Net Outstanding", "Oldest (d)"];
  const exportData = () => sorted.map(({ g }, i) => ({ n: i + 1, party: g.name, ...Object.fromEntries(BUCKETS.map((b) => [b.key, g.buckets[b.key]])), advance: g.advance ? -g.advance : 0, total: g.total, oldest: g.oldest }));
  const cols = [{ key: "n", label: "#" }, { key: "party", label: "Party" }, ...BUCKETS.map((b) => ({ key: b.key, label: `${b.label} days` })), { key: "advance", label: "Advance" }, { key: "total", label: "Net Outstanding" }, { key: "oldest", label: "Oldest (days)" }];
  const pdf = () => savePdf(`Ageing_Summary_${snap.asOn}.pdf`, {
    company, note: filterNote, title: "Ageing Summary — party wise", asOn: snap.asOn, landscape: true,
    kpis: [
      { label: "Net outstanding", value: inr(totals.net) },
      { label: `Overdue > ${settings.creditDays} days`, value: inr(totals.overdue), color: "#B4453A" },
      { label: "Avg. age (weighted)", value: `${weightedAge(snap.bills)} days` },
      { label: "Parties", value: String(rows.length) },
    ],
    head,
    body: sorted.map(({ g }, i) => [i + 1, g.name, ...BUCKETS.map((b) => money(g.buckets[b.key])), g.advance ? `-${formatCurrency(g.advance)}` : "–", formatCurrency(g.total), g.oldest || "–"]),
    foot: ["", "TOTAL", ...BUCKETS.map((b) => formatCurrency(totals.buckets[b.key])), totals.advance ? `-${formatCurrency(totals.advance)}` : "–", formatCurrency(totals.net), ""],
    align: ["center", "left", ...BUCKETS.map(() => "right"), "right", "right", "center"],
    colColors: Object.fromEntries(BUCKETS.map((b, i) => [i + 2, b.color])),
    colWidths: { 0: 24 },
  });
  const th = (key, label, color, cls = "text-right px-3") => (
    <th onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))} style={color ? { color } : undefined}
      className={`${cls} py-3 cursor-pointer select-none whitespace-nowrap`}>{label}{sort.key === key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}</th>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={Hourglass} label="Avg. age" value={`${weightedAge(snap.bills)} days`} sub="weighted by amount" />
        <Stat icon={AlertTriangle} label="At risk > 180d" value={compactINR(atRisk)} sub={`${totals.due ? Math.round((atRisk / totals.due) * 100) : 0}% of dues`} tone="text-rust" />
        <Stat icon={Percent} label="Overdue share" value={`${totals.due ? Math.round((totals.overdue / totals.due) * 100) : 0}%`} sub={`beyond ${settings.creditDays} days`} tone="text-rust" />
        <Stat icon={Clock} label="Oldest bill" value={oldest ? `${oldest.days} days` : "–"} sub={oldest?.party} />
        <Stat icon={Trophy} label="Top 5 parties" value={`${totals.due ? Math.round((top5 / totals.due) * 100) : 0}%`} sub="of total dues" />
      </div>

      <div className="bg-panel border border-line rounded-2xl p-4">
        <div className="flex h-3 rounded-full overflow-hidden bg-paper">
          {BUCKETS.map((b) => totals.buckets[b.key] > 0 && <div key={b.key} style={{ width: `${(totals.buckets[b.key] / dueSum) * 100}%`, background: b.color }} />)}
        </div>
        <div className="grid grid-cols-5 gap-2 mt-4">
          {BUCKETS.map((b) => {
            const parties = rows.filter((r) => r.g.buckets[b.key] > 0).length;
            return (
              <button key={b.key} onClick={() => setBk(bk === b.key ? null : b.key)} className={`rounded-xl border p-2.5 text-center transition ${bk === b.key ? "bg-white shadow-md" : "bg-paper/50 border-line hover:bg-white"}`} style={{ borderTop: `3px solid ${b.color}`, ...(bk === b.key ? { borderColor: b.color } : {}) }}>
                <div className="text-[10px] font-bold" style={{ color: b.color }}>{b.label}d</div>
                <div className="text-sm font-display font-bold mt-0.5">{compactINR(totals.buckets[b.key])}</div>
                <div className="text-[10px] text-muted">{Math.round((totals.buckets[b.key] / dueSum) * 100)}% · {parties} pty</div>
              </button>
            );
          })}
        </div>
      </div>

      {top10.length > 0 && (
        <div className="bg-panel border border-line rounded-2xl p-4">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Top {top10.length} parties — ageing mix</div>
          <div className="flex flex-col gap-2.5">
            {top10.map((r) => (
              <button key={r.g.key} onClick={() => onOpen(r.g.key)} className="text-left">
                <div className="flex items-baseline justify-between gap-2 text-xs"><span className="font-semibold truncate">{r.g.name}</span><span className="font-bold whitespace-nowrap">{compactINR(r.g.due)}</span></div>
                <div className="h-2.5 rounded-full bg-paper overflow-hidden mt-1" style={{ width: `${Math.max(6, (r.g.due / top10Max) * 100)}%` }}>
                  <div className="flex h-full">{BUCKETS.map((b) => r.g.buckets[b.key] > 0 && <div key={b.key} style={{ width: `${(r.g.buckets[b.key] / r.g.due) * 100}%`, background: b.color }} />)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <ReportBar title={bk ? `Parties with ${BUCKETS.find((b) => b.key === bk).label} day bills` : "Ageing summary — party wise"} note={bk ? "Filtered by the ageing box you tapped — tap it again to clear." : "Tap an ageing box to filter. Tap a party for its bills. Tap a heading to sort."}
        onExcel={() => exportExcel(`Ageing_Summary_${snap.asOn}.xlsx`, "Ageing Summary", exportData(), cols)} onPdf={pdf} />

      <div className="bg-panel border border-line rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-[11px] text-muted uppercase tracking-wide border-b border-line bg-paper/60">
              <th className="px-3 py-3 text-left w-8">#</th>
              {th("name", "Party", null, "text-left px-3 sticky left-8 bg-paper z-10")}
              {BUCKETS.map((b) => th(b.key, b.label, b.color))}
              {th("advance", "Adv")}
              {th("total", "Net", null, "text-right px-3")}
              {th("oldest", "Oldest", null, "text-right px-4")}
            </tr>
          </thead>
          <tbody>
            {shownRows.map(({ g }, i) => (
              <tr key={g.key} onClick={() => onOpen(g.key)} className="border-b border-line last:border-0 cursor-pointer hover:bg-paper/60">
                <td className="px-3 py-2.5 text-muted text-xs">{i + 1}</td>
                <td className="px-3 font-medium sticky left-8 bg-panel z-10 max-w-[170px] truncate">{g.name}</td>
                {BUCKETS.map((b) => (
                  <td key={b.key} style={heat(g.buckets[b.key], b)} title={g.buckets[b.key] ? inr(g.buckets[b.key]) : ""}
                    className={`text-right px-3 whitespace-nowrap ${g.buckets[b.key] ? "" : "text-muted/40"}`}>{g.buckets[b.key] ? compactINR(g.buckets[b.key], false) : "–"}</td>
                ))}
                <td className="text-right px-3 text-loom whitespace-nowrap">{g.advance ? `-${compactINR(g.advance, false)}` : "–"}</td>
                <td className="text-right px-3 font-semibold whitespace-nowrap">{compactINR(g.total, false)}</td>
                <td className="text-right px-4">{g.oldest ? <DaysBadge days={g.oldest} /> : "–"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t-2 border-line bg-paper/70">
              <td className="px-3 py-3" />
              <td className="px-3 py-3 sticky left-8 bg-paper z-10">Total</td>
              {BUCKETS.map((b) => <td key={b.key} className="text-right px-3 whitespace-nowrap">{compactINR(totals.buckets[b.key], false)}</td>)}
              <td className="text-right px-3 text-loom whitespace-nowrap">{totals.advance ? `-${compactINR(totals.advance, false)}` : "–"}</td>
              <td className="text-right px-3 whitespace-nowrap">{compactINR(totals.net, false)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-muted text-center">Amounts in ₹ (K = thousand, L = lakh, Cr = crore). PDF/Excel carry exact figures.</p>
    </div>
  );
}

// ======================= Bill-wise Ageing =======================
export function BillsTab({ snap, settings, company }) {
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState("all");
  const [grouped, setGrouped] = useState(false);
  const [sort, setSort] = useState({ key: "days", dir: -1 });

  const list = useMemo(() => {
    const l = snap.bills.filter((b) => b.outstanding > 0)
      .filter((b) => !q || b.party.toLowerCase().includes(q.toLowerCase()) || b.billNo.toLowerCase().includes(q.toLowerCase()))
      .filter((b) => bucket === "all" || bucketOf(b.days).key === bucket);
    return [...l].sort((a, b) => {
      if (grouped) return a.party.localeCompare(b.party) || a.date.localeCompare(b.date);
      const x = a[sort.key], y = b[sort.key];
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * sort.dir;
    });
  }, [snap, q, bucket, sort, grouped]);

  const total = list.reduce((s, b) => s + b.outstanding, 0);
  const overdue = list.filter((b) => b.days > settings.creditDays).length;
  const view = useMemo(() => {
    if (!grouped) return list.map((b) => ({ type: "bill", b }));
    const out = [];
    let cur = null;
    list.forEach((b) => {
      if (!cur || cur.party !== b.party) { cur = { type: "party", party: b.party, sum: 0, n: 0 }; out.push(cur); }
      cur.sum += b.outstanding; cur.n += 1;
      out.push({ type: "bill", b });
    });
    return out;
  }, [list, grouped]);

  const th = (key, label, right) => (
    <th onClick={() => !grouped && setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))}
      className={`${right ? "text-right" : "text-left"} px-3 py-3 ${grouped ? "" : "cursor-pointer select-none hover:text-ink"} whitespace-nowrap`}>
      {label}{!grouped && sort.key === key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
    </th>
  );
  const cols = [
    { key: "party", label: "Party" }, { key: "billNo", label: "Bill No" }, { key: "date", label: "Bill Date" },
    { key: "amount", label: "Bill Amount" }, { key: "credit", label: "Received" }, { key: "outstanding", label: "Outstanding" }, { key: "days", label: "Ageing Days" },
  ];
  const pdf = () => savePdf(`Billwise_Ageing_${snap.asOn}.pdf`, {
    company, note: filterNote, title: `Bill-wise ageing${bucket !== "all" ? ` — ${BUCKETS.find((b) => b.key === bucket).label} days` : ""}`, asOn: snap.asOn,
    kpis: [
      { label: "Bills", value: String(list.length) },
      { label: "Outstanding", value: inr(total) },
      { label: "Avg. age", value: `${weightedAge(list)} days` },
      { label: `Beyond ${settings.creditDays}d`, value: String(overdue), color: "#B4453A" },
    ],
    head: ["Party", "Bill No", "Bill Date", "Bill Amount", "Received", "Outstanding", "Days"],
    body: list.map((b) => [b.party, b.billNo, fmtDate(b.date), money(b.amount), money(b.credit), formatCurrency(b.outstanding), b.days]),
    foot: [`${list.length} bills`, "", "", "", "", formatCurrency(total), ""],
    align: ["left", "left", "left", "right", "right", "right", "center"],
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Hourglass} label="Bills" value={list.length} sub={bucket === "all" ? "all pending" : "in selected ageing"} />
        <Stat icon={Percent} label="Outstanding" value={compactINR(total)} sub={inr(total)} />
        <Stat icon={Clock} label="Avg. age" value={`${weightedAge(list)} days`} sub="weighted" />
        <Stat icon={AlertTriangle} label={`Beyond ${settings.creditDays}d`} value={overdue} sub="bills" tone="text-rust" />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Party or bill no…" className="border border-line rounded-lg pl-9 pr-3 py-2 text-sm bg-white w-full outline-none focus:border-ink2" />
        </div>
        <button onClick={() => setGrouped(!grouped)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${grouped ? "bg-ink text-white border-ink" : "border-line hover:bg-paper"}`}>Group by party</button>
        <button onClick={() => setBucket("all")} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${bucket === "all" ? "bg-ink text-white border-ink" : "border-line hover:bg-paper"}`}>All</button>
        {BUCKETS.map((b) => (
          <button key={b.key} onClick={() => setBucket(b.key)} className="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
            style={bucket === b.key ? { background: b.color, color: "#fff", borderColor: b.color } : { color: b.color, borderColor: `${b.color}55` }}>{b.label}</button>
        ))}
      </div>
      <ReportBar title="Bill-wise ageing" note="Every pending bill with how many days it has been outstanding."
        onExcel={() => exportExcel(`Billwise_Ageing_${snap.asOn}.xlsx`, "Bill-wise", list.map((b) => ({ ...b, date: fmtDate(b.date) })), cols)} onPdf={pdf} />
      <div className="bg-panel border border-line rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="text-[11px] text-muted uppercase tracking-wide border-b border-line bg-paper/60">
            {th("party", "Party")}{th("billNo", "Bill No")}{th("date", "Bill Date")}{th("amount", "Bill Amt", true)}{th("credit", "Received", true)}{th("outstanding", "Outstanding", true)}{th("days", "Days", true)}
          </tr></thead>
          <tbody>
            {view.map((v, i) => v.type === "party" ? (
              <tr key={`p${i}`} className="bg-ink/5 border-b border-line">
                <td className="px-3 py-2 font-bold text-ink" colSpan={5}>{v.party} <span className="text-muted font-medium text-xs">· {v.n} bill{v.n > 1 ? "s" : ""}</span></td>
                <td className="px-3 text-right font-bold">{formatCurrency(v.sum)}</td><td />
              </tr>
            ) : (
              <tr key={i} className="border-b border-line last:border-0 odd:bg-paper/40">
                <td className="px-3 py-2.5 font-medium">{grouped ? <span className="text-muted/0">·</span> : v.b.party}</td>
                <td className="px-3">{v.b.billNo}</td>
                <td className="px-3 whitespace-nowrap">{fmtDate(v.b.date)}</td>
                <td className="px-3 text-right">{formatCurrency(v.b.amount)}</td>
                <td className="px-3 text-right text-muted">{v.b.credit ? formatCurrency(v.b.credit) : "–"}</td>
                <td className="px-3 text-right font-semibold">{formatCurrency(v.b.outstanding)}</td>
                <td className="px-3 text-right"><DaysBadge days={v.b.days} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="font-bold border-t-2 border-line bg-paper/70">
            <td className="px-3 py-3" colSpan={5}>{list.length} bills</td>
            <td className="px-3 text-right">{formatCurrency(total)}</td><td />
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}

// ======================= Month-wise =======================
export function MonthTab({ snap, settings, company, filterNote }) {
  const data = useMemo(() => {
    const m = new Map();
    snap.bills.filter((b) => b.outstanding > 0).forEach((b) => {
      const k = b.date.slice(0, 7);
      if (!m.has(k)) m.set(k, { key: k, bills: 0, amount: 0, wd: 0, parties: new Set() });
      const r = m.get(k);
      r.bills += 1; r.amount += b.outstanding; r.wd += b.outstanding * b.days; r.parties.add(b.party);
    });
    const dueTotal = [...m.values()].reduce((s, r) => s + r.amount, 0) || 1;
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key)).map((r) => {
      const [y, mo] = r.key.split("-").map(Number);
      const avg = Math.round(r.wd / r.amount);
      return { key: r.key, label: `${MONTHS[mo - 1]} ${y}`, short: `${MONTHS[mo - 1]} ${String(y).slice(2)}`, bills: r.bills, amount: r.amount, share: (r.amount / dueTotal) * 100, avg, parties: r.parties.size, color: bucketOf(avg).color };
    });
  }, [snap]);
  const total = data.reduce((s, r) => s + r.amount, 0);
  const cols = [{ key: "label", label: "Invoice month" }, { key: "bills", label: "Bills" }, { key: "parties", label: "Parties" }, { key: "amount", label: "Outstanding" }, { key: "sharePct", label: "% of dues" }, { key: "avg", label: "Avg age (days)" }];
  const pdf = () => savePdf(`Monthwise_Outstanding_${snap.asOn}.pdf`, {
    company, note: filterNote, title: "Month-wise outstanding (by invoice month)", asOn: snap.asOn,
    kpis: [{ label: "Outstanding", value: inr(total) }, { label: "Months", value: String(data.length) }, { label: "Bills", value: String(data.reduce((s, r) => s + r.bills, 0)) }, { label: "Avg. age", value: `${weightedAge(snap.bills)} days` }],
    head: ["Invoice month", "Bills", "Parties", "Outstanding", "% of dues", "Avg age (days)"],
    body: data.map((r) => [r.label, r.bills, r.parties, formatCurrency(r.amount), `${r.share.toFixed(1)}%`, r.avg]),
    foot: ["TOTAL", data.reduce((s, r) => s + r.bills, 0), "", formatCurrency(total), "100%", ""],
    align: ["left", "center", "center", "right", "right", "center"],
  });
  // ---- financial-year grouping (Apr–Mar) so ~70 months become a handful of readable blocks ----
  const years = useMemo(() => {
    const m = new Map();
    snap.bills.filter((b) => b.outstanding > 0).forEach((b) => {
      const sy = fyStartYear(b.date);
      if (!m.has(sy)) m.set(sy, { sy, label: fyLabel(sy), amount: 0, bills: 0, wd: 0, parties: new Set(), months: [] });
      const y = m.get(sy);
      y.amount += b.outstanding; y.bills += 1; y.wd += b.outstanding * b.days; y.parties.add(b.party);
    });
    data.forEach((d) => { const y = m.get(fyStartYear(`${d.key}-01`)); if (y) y.months.push(d); });
    return [...m.values()].sort((a, b) => b.sy - a.sy).map((y) => {
      const avg = y.amount ? Math.round(y.wd / y.amount) : 0;
      return { ...y, parties: y.parties.size, avg, color: bucketOf(avg).color, share: (y.amount / (total || 1)) * 100, months: [...y.months].reverse(), max: Math.max(...y.months.map((x) => x.amount), 1) };
    });
  }, [snap, data, total]);
  const curSy = years[0]?.sy;
  const [open, setOpen] = useState(() => new Set(curSy != null ? [curSy] : []));
  const toggle = (sy) => setOpen((o) => { const n = new Set(o); n.has(sy) ? n.delete(sy) : n.add(sy); return n; });
  const allOpen = years.length > 0 && open.size === years.length;
  const biggest = data.reduce((a, r) => (r.amount > (a?.amount || 0) ? r : a), null);
  const oldest = data[0];
  const chartData = [...years].reverse().map((y) => ({ ...y, tick: y.label }));

  return (
    <div className="flex flex-col gap-4">
      <ReportBar title="Month-wise outstanding" note="Today's outstanding, grouped by the financial year (Apr–Mar) and month of the invoice."
        onExcel={() => exportExcel(`Monthwise_Outstanding_${snap.asOn}.xlsx`, "Month-wise", data.map((r) => ({ ...r, sharePct: Number(r.share.toFixed(1)) })), cols)} onPdf={pdf} />

      <div className="grid grid-cols-2 gap-2.5">
        <Stat icon={Clock} label="Total due" value={inr(total)} sub={`${data.reduce((s, r) => s + r.bills, 0)} bills · ${data.length} months`} />
        <Stat icon={Hourglass} label="Avg. age" value={`${weightedAge(snap.bills)} days`} sub={oldest ? `oldest: ${oldest.label}` : ""} tone="text-rust" />
        <Stat icon={TrendingUp} label="Biggest month" value={biggest ? compactINR(biggest.amount) : "–"} sub={biggest ? `${biggest.label} · ${biggest.share.toFixed(0)}% of dues` : ""} />
        <Stat icon={Percent} label="Before current FY" value={compactINR(years.filter((y) => y.sy !== curSy).reduce((s, y) => s + y.amount, 0))} sub="older financial years" tone="text-rust" />
      </div>

      <div className="bg-panel border border-line rounded-2xl p-4">
        <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Financial year-wise</div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 4, right: 4, top: 22 }}>
              <XAxis dataKey="tick" tick={{ fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis hide />
              <Tooltip formatter={(v) => inr(v)} labelFormatter={(l) => `FY ${l}`} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} onClick={(d) => d?.sy != null && setOpen((o) => new Set(o).add(d.sy))}>
                {chartData.map((d) => <Cell key={d.sy} fill={d.color} />)}
                <LabelList dataKey="amount" position="top" formatter={(v) => compactINR(v, false)} style={{ fontSize: 11, fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted text-center mt-1">Bar colour = average age of that year's bills (green fresh → red old). Tap a bar to open that year.</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-muted uppercase tracking-wide">Year → month breakup</div>
        <button onClick={() => setOpen(allOpen ? new Set() : new Set(years.map((y) => y.sy)))} className="text-xs font-semibold text-ink2 hover:underline">{allOpen ? "Collapse all" : "Expand all"}</button>
      </div>

      <div className="flex flex-col gap-3">
        {years.map((y) => {
          const isOpen = open.has(y.sy);
          return (
            <div key={y.sy} className="bg-panel border border-line rounded-2xl overflow-hidden">
              <button onClick={() => toggle(y.sy)} className="w-full text-left px-4 py-3.5 flex flex-col gap-2" aria-expanded={isOpen}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-base">FY {y.label}</span>
                    {y.sy === curSy && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-loom/10 text-loom">CURRENT</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-lg">{inr(y.amount)}</span>
                    <ChevronDown size={18} className={`text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </div>
                <div className="h-2 rounded-full bg-paper overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(2, y.share)}%`, background: y.color }} /></div>
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>{y.share.toFixed(1)}% of dues · {y.bills} bills · {y.parties} parties</span>
                  <DaysBadge days={y.avg} />
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-line bg-paper/40 divide-y divide-line">
                  {y.months.map((r) => (
                    <div key={r.key} className="px-4 py-2.5 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">{r.label}</span>
                        <span className="font-bold text-sm">{formatCurrency(r.amount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-line/60 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.amount / y.max) * 100)}%`, background: r.color }} /></div>
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <span>{r.bills} bill{r.bills === 1 ? "" : "s"} · {r.parties} part{r.parties === 1 ? "y" : "ies"} · {r.share.toFixed(1)}%</span>
                        <DaysBadge days={r.avg} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-ink text-white rounded-2xl px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-sm">Total outstanding</span>
        <span className="font-display font-bold text-lg">{inr(total)}</span>
      </div>
    </div>
  );
}

// ======================= Collection Priority =======================
export function PriorityTab({ rows, settings, snap, company, filterNote, startQueue, onOpen }) {
  const list = rows.filter((r) => r.overdue > 0).sort((a, b) => b.overdue - a.overdue);
  const max = list[0]?.overdue || 1;
  const sendable = list.filter((r) => r.match.status === "auto" && r.phone);
  const overdueTotal = list.reduce((s, r) => s + r.overdue, 0);
  const overdueBills = (r) => r.g.bills.filter((b) => b.outstanding > 0 && b.days > settings.creditDays).length;
  const cols = [{ key: "n", label: "#" }, { key: "party", label: "Party" }, { key: "bills", label: "Overdue bills" }, { key: "overdue", label: "Overdue amount" }, { key: "due", label: "Total dues" }, { key: "pct", label: "% overdue" }, { key: "oldest", label: "Oldest (days)" }, { key: "phone", label: "Phone" }];
  const data = () => list.map((r, i) => ({ n: i + 1, party: r.g.name, bills: overdueBills(r), overdue: r.overdue, due: r.g.due, pct: Math.round((r.overdue / r.g.due) * 100), oldest: r.g.oldest, phone: r.phone || "" }));
  const pdf = () => savePdf(`Collection_Priority_${snap.asOn}.pdf`, {
    company, note: filterNote, title: `Collection priority — overdue beyond ${settings.creditDays} days`, asOn: snap.asOn,
    kpis: [{ label: "Parties overdue", value: String(list.length) }, { label: "Overdue amount", value: inr(overdueTotal), color: "#B4453A" }, { label: "Overdue bills", value: String(list.reduce((s, r) => s + overdueBills(r), 0)) }, { label: "Oldest bill", value: `${Math.max(0, ...list.map((r) => r.g.oldest))} days` }],
    head: ["#", "Party", "Overdue bills", "Overdue amount", "Total dues", "% overdue", "Oldest (d)", "Phone"],
    body: data().map((d) => [d.n, d.party, d.bills, formatCurrency(d.overdue), formatCurrency(d.due), `${d.pct}%`, d.oldest, d.phone || "–"]),
    foot: ["", "TOTAL", list.reduce((s, r) => s + overdueBills(r), 0), formatCurrency(overdueTotal), formatCurrency(list.reduce((s, r) => s + r.g.due, 0)), "", "", ""],
    align: ["center", "left", "center", "right", "right", "center", "center", "left"],
    colWidths: { 0: 24 },
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={AlertTriangle} label="Parties" value={list.length} sub="with overdue bills" />
        <Stat icon={Percent} label="Overdue" value={compactINR(overdueTotal)} sub={inr(overdueTotal)} tone="text-rust" />
        <Stat icon={Clock} label="Oldest" value={`${Math.max(0, ...list.map((r) => r.g.oldest))}d`} sub={`credit days: ${settings.creditDays}`} />
      </div>
      <ReportBar title="Collection priority" note="Parties ranked by overdue amount — follow up from the top."
        onExcel={() => exportExcel(`Collection_Priority_${snap.asOn}.xlsx`, "Collection Priority", data(), cols)} onPdf={pdf} />
      <div className="flex justify-end">
        <button disabled={!sendable.length} onClick={() => startQueue(sendable, { onlyOverdue: true })}
          className="bg-loom text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-40">
          <MessageCircle size={14} /> Remind all overdue ({sendable.length})
        </button>
      </div>
      {list.map((r, i) => {
        const ob = overdueBills(r);
        return (
          <div key={r.g.key} className="bg-panel border border-line rounded-xl p-3 sm:p-4">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 items-start">
              <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${i < 3 ? "bg-rust text-white" : "bg-ink/10 text-ink"}`}>{i + 1}</span>
              <div className="min-w-0">
                <button onClick={() => onOpen(r.g.key)} className="font-semibold text-sm text-left hover:underline leading-snug">{r.g.name}</button>
                <div className="text-xs text-muted mt-1 flex items-center gap-1.5 flex-wrap">
                  <span>{ob} overdue bill{ob > 1 ? "s" : ""}</span><span>·</span><span className="flex items-center gap-1">oldest <DaysBadge days={r.g.oldest} /></span><RiskBadge level={riskOf(r.g, r.overdue, settings.creditDays)} />
                </div>
                <div className="text-xs text-muted mt-1">Total dues <b className="text-ink">{inr(r.g.due)}</b></div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Overdue</div>
                <div className="font-display font-bold text-base text-rust whitespace-nowrap">{inr(r.overdue)}</div>
                <div className="text-[11px] text-muted whitespace-nowrap">{Math.round((r.overdue / r.g.due) * 100)}% of dues</div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 h-2 rounded-full bg-paper overflow-hidden"><div className="h-full rounded-full bg-rust" style={{ width: `${(r.overdue / max) * 100}%` }} /></div>
              <div className="flex gap-1.5 shrink-0">
                {r.phone && <a href={`tel:${r.phone}`} className="p-2 rounded-lg border border-line hover:bg-paper" aria-label="Call"><Phone size={15} /></a>}
                <button disabled={!(r.match.status === "auto" && r.phone)} onClick={() => startQueue([r], { onlyOverdue: true })} className="p-2 rounded-lg bg-loom text-white disabled:opacity-30" aria-label="WhatsApp reminder"><MessageCircle size={15} /></button>
              </div>
            </div>
          </div>
        );
      })}
      {!list.length && <div className="text-center text-sm text-muted py-10 flex flex-col items-center gap-2"><Clock size={22} />No overdue bills 🎉</div>}
    </div>
  );
}


// ======================= Movement vs an earlier report =======================
export function MovementTab({ snap, company, filterNote }) {
  const hist = snap.history || [];
  const [idx, setIdx] = useState(Math.max(0, hist.length - 1));
  const [flt, setFlt] = useState("all");
  const cur = useMemo(() => summarizeSnapshot(snap), [snap]);
  const prev = hist[Math.min(idx, hist.length - 1)];

  const data = useMemo(() => {
    if (!prev) return [];
    const names = new Set([...Object.keys(prev.parties), ...Object.keys(cur.parties)]);
    return [...names].map((n) => {
      const a = prev.parties[n]?.total || 0;
      const b = cur.parties[n]?.total || 0;
      const kind = !a && b ? "new" : a && !b ? "cleared" : b > a ? "up" : b < a ? "down" : "same";
      return { name: n, prev: a, cur: b, diff: b - a, pct: a ? ((b - a) / Math.abs(a)) * 100 : null, kind };
    }).filter((r) => r.prev || r.cur).sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  }, [prev, cur]);

  if (!hist.length) {
    return (
      <div className="text-center text-sm text-muted py-12 border border-dashed border-line rounded-xl px-6">
        <Clock size={22} className="mx-auto mb-2" />
        Movement compares this report with your earlier uploads. It starts building history from your <b>next upload</b> — upload the next outstanding report and come back here.
      </div>
    );
  }
  const count = (k) => data.filter((r) => r.kind === k).length;
  const change = cur.net - prev.net;
  const list = flt === "all" ? data.filter((r) => r.kind !== "same") : data.filter((r) => r.kind === flt);
  const kinds = [["all", "Changed"], ["up", `Increased (${count("up")})`], ["down", `Reduced (${count("down")})`], ["new", `New (${count("new")})`], ["cleared", `Cleared (${count("cleared")})`]];
  const colr = (d) => (d > 0 ? "text-rust" : d < 0 ? "text-loom" : "text-muted");
  const sign = (d) => (d > 0 ? "+" : d < 0 ? "-" : "");
  const cols = [{ key: "name", label: "Party" }, { key: "prev", label: `Outstanding ${fmtDate(prev.asOn)}` }, { key: "cur", label: `Outstanding ${fmtDate(cur.asOn)}` }, { key: "diff", label: "Change" }, { key: "pctTxt", label: "Change %" }, { key: "kindTxt", label: "Status" }];
  const kindTxt = { up: "Increased", down: "Reduced", new: "New", cleared: "Cleared", same: "No change" };
  const exportRows = () => list.map((r) => ({ ...r, pctTxt: r.pct == null ? "" : `${r.pct.toFixed(1)}%`, kindTxt: kindTxt[r.kind] }));
  const pdf = () => savePdf(`Movement_${prev.asOn}_to_${cur.asOn}.pdf`, {
    company, note: filterNote, title: `Outstanding movement — ${fmtDate(prev.asOn)} to ${fmtDate(cur.asOn)}`, asOn: cur.asOn,
    kpis: [
      { label: `Net on ${fmtDate(prev.asOn)}`, value: inr(prev.net) },
      { label: `Net on ${fmtDate(cur.asOn)}`, value: inr(cur.net) },
      { label: "Change", value: `${sign(change)}${inr(Math.abs(change))}`, color: change > 0 ? "#B4453A" : "#2F6E5D" },
      { label: "Parties changed", value: String(data.filter((r) => r.kind !== "same").length) },
    ],
    head: ["Party", "Previous", "Current", "Change", "Change %", "Status"],
    body: list.map((r) => [r.name, formatCurrency(r.prev), formatCurrency(r.cur), `${sign(r.diff)}${formatCurrency(Math.abs(r.diff))}`, r.pct == null ? "–" : `${r.pct.toFixed(1)}%`, kindTxt[r.kind]]),
    foot: ["TOTAL", formatCurrency(prev.net), formatCurrency(cur.net), `${sign(change)}${formatCurrency(Math.abs(change))}`, "", ""],
    align: ["left", "right", "right", "right", "right", "center"],
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="text-muted">Compare with</span>
        <select value={idx} onChange={(e) => setIdx(Number(e.target.value))} className="border border-line rounded-lg px-2 py-1.5 text-sm font-semibold bg-white">
          {hist.map((h, i) => <option key={h.asOn} value={i}>{fmtDate(h.asOn)}</option>)}
        </select>
        <span className="text-muted">→ {fmtDate(cur.asOn)}</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Clock} label="Earlier" value={compactINR(prev.net)} sub={fmtDate(prev.asOn)} />
        <Stat icon={Clock} label="Now" value={compactINR(cur.net)} sub={fmtDate(cur.asOn)} />
        <Stat icon={change > 0 ? TrendingUp : TrendingDown} label="Change" value={`${sign(change)}${compactINR(Math.abs(change))}`} sub={prev.net ? `${((change / Math.abs(prev.net)) * 100).toFixed(1)}%` : ""} tone={colr(change)} />
        <Stat icon={Percent} label="Parties changed" value={data.filter((r) => r.kind !== "same").length} sub={`${count("new")} new · ${count("cleared")} cleared`} />
      </div>

      <div className="bg-panel border border-line rounded-2xl p-4">
        <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Ageing buckets — then vs now</div>
        <div className="grid grid-cols-5 gap-2">
          {BUCKETS.map((b) => {
            const d = cur.buckets[b.key] - (prev.buckets[b.key] || 0);
            return (
              <div key={b.key} className="rounded-xl bg-paper/60 border border-line p-2 text-center" style={{ borderTop: `3px solid ${b.color}` }}>
                <div className="text-[10px] font-bold" style={{ color: b.color }}>{b.label}d</div>
                <div className="text-xs font-bold mt-0.5">{compactINR(cur.buckets[b.key])}</div>
                <div className={`text-[10px] font-semibold ${colr(d)}`}>{d ? `${sign(d)}${compactINR(Math.abs(d))}` : "–"}</div>
              </div>
            );
          })}
        </div>
      </div>

      <ReportBar title="Party-wise movement" note="Biggest changes first. Red = outstanding went up, green = came down."
        onExcel={() => exportExcel(`Movement_${prev.asOn}_to_${cur.asOn}.xlsx`, "Movement", exportRows(), cols)} onPdf={pdf} />
      <div className="flex gap-2 flex-wrap">
        {kinds.map(([id, label]) => <button key={id} onClick={() => setFlt(id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${flt === id ? "bg-ink text-white border-ink" : "border-line hover:bg-paper"}`}>{label}</button>)}
      </div>
      <div className="bg-panel border border-line rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="text-[11px] text-muted uppercase tracking-wide border-b border-line bg-paper/60">
            <th className="text-left px-4 py-3">Party</th><th className="text-right px-3">Earlier</th><th className="text-right px-3">Now</th><th className="text-right px-4">Change</th>
          </tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.name} className="border-b border-line last:border-0 odd:bg-paper/40">
                <td className="px-4 py-2.5 font-medium">{r.name} {r.kind === "new" && <span className="text-[10px] font-bold text-thread ml-1">NEW</span>}{r.kind === "cleared" && <span className="text-[10px] font-bold text-loom ml-1">CLEARED</span>}</td>
                <td className="px-3 text-right text-muted whitespace-nowrap">{r.prev ? formatCurrency(r.prev) : "–"}</td>
                <td className="px-3 text-right whitespace-nowrap">{r.cur ? formatCurrency(r.cur) : "–"}</td>
                <td className={`px-4 text-right font-semibold whitespace-nowrap ${colr(r.diff)}`}>{sign(r.diff)}{formatCurrency(Math.abs(r.diff))}{r.pct != null && <span className="text-[10px] ml-1 opacity-70">({r.pct.toFixed(0)}%)</span>}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={4} className="text-center text-muted py-8">Nothing in this group.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
