// outstandingPlan.jsx — "Payment Plan" tab: customers beyond N days (default 120) with editable
// Payment Cleared / Payment Expected (amount + date) / Remarks, ready to send to the mill (Excel or PDF).

import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { formatCurrency, downloadBlob } from "../utils/helpers";
import { fmtDate } from "../utils/outstanding";
import { buildPlanRows, planTotals, downloadPlanExcel, buildPlanPdf } from "../utils/paymentPlan";

const inr = (n) => `₹${formatCurrency(n)}`;
const inp = "border border-line rounded-lg px-2 py-1.5 text-sm bg-white w-full outline-none focus:border-ink2";

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted xl:hidden">{label}</span>
      {children}
    </label>
  );
}

const COLS = "xl:grid-cols-[minmax(150px,1.5fr)_96px_110px_128px_96px_110px_128px_minmax(190px,2.2fr)]";

function PlanRow({ r, days, onChange }) {
  const [cleared, setCleared] = useState(r.cleared ? String(r.cleared) : "");
  const [clearedOn, setClearedOn] = useState(r.clearedOn);
  const [expected, setExpected] = useState(r.expected ? String(r.expected) : "");
  const [expectedOn, setExpectedOn] = useState(r.expectedOn);
  const [remarks, setRemarks] = useState(r.remarks);
  const save = (patch) => onChange(r.key, r.name, patch);
  const n = (v) => Number(String(v).replace(/,/g, "")) || 0;
  return (
    <div className={`bg-white border border-line rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 ${COLS} gap-x-3 gap-y-2 items-center`}>
      <div className="col-span-2 sm:col-span-3 xl:col-span-1 min-w-0">
        <div className="font-semibold text-sm truncate">{r.name}</div>
        <div className="text-[11px] text-muted">{r.n ? `${r.n} bill${r.n > 1 ? "s" : ""} · oldest ${r.oldest} days` : `no longer beyond ${days} days`}</div>
      </div>
      <Field label={`Outstanding > ${days}d`}><div className="text-sm font-bold text-rust xl:text-right">{inr(r.amt)}</div></Field>
      <Field label="Payment cleared (₹)"><input value={cleared} inputMode="decimal" onChange={(e) => setCleared(e.target.value.replace(/[^\d.,]/g, ""))} onBlur={() => save({ cleared: n(cleared) })} className={inp} placeholder="0" /></Field>
      <Field label="Cleared on"><input type="date" value={clearedOn} onChange={(e) => setClearedOn(e.target.value)} onBlur={() => save({ clearedOn })} className={inp} /></Field>
      <Field label="Balance"><div className="text-sm font-semibold xl:text-right">{inr(Math.max(0, r.amt - n(cleared)))}</div></Field>
      <Field label="Payment expected (₹)"><input value={expected} inputMode="decimal" onChange={(e) => setExpected(e.target.value.replace(/[^\d.,]/g, ""))} onBlur={() => save({ expected: n(expected) })} className={inp} placeholder="0" /></Field>
      <Field label="Expected on"><input type="date" value={expectedOn} onChange={(e) => setExpectedOn(e.target.value)} onBlur={() => save({ expectedOn })} className={inp} /></Field>
      <div className="col-span-2 sm:col-span-3 xl:col-span-1">
        <Field label="Remarks"><input value={remarks} onChange={(e) => setRemarks(e.target.value)} onBlur={() => save({ remarks: remarks.trim() })} className={inp} placeholder="e.g. cheque promised Friday" /></Field>
      </div>
    </div>
  );
}

export default function PaymentPlanTab({ bills, asOn, company, days, onDays, plan, onChange, showToast }) {
  const [limit, setLimit] = useState(String(days));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => buildPlanRows({ bills, days, plan }), [bills, days, plan]);
  const shown = rows.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));
  const t = planTotals(rows);
  const commitDays = () => { const v = Math.max(1, Math.round(Number(limit) || 120)); setLimit(String(v)); if (v !== days) onDays(v); };
  const pdf = async () => {
    setBusy(true);
    try { downloadBlob(`Payment_Plan_${days}d_${asOn}.pdf`, await buildPlanPdf({ rows, days, asOn, company })); }
    catch { showToast("Couldn't build the PDF — please try again.", "error"); }
    finally { setBusy(false); }
  };
  const Stat = ({ label, value, tone = "" }) => (
    <div className="bg-white border border-line rounded-xl px-3 py-2 min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-base font-bold whitespace-nowrap ${tone}`}>{value}</div>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Stat label={`Customers > ${days}d`} value={t.n} />
        <Stat label="Outstanding" value={inr(t.amt)} tone="text-rust" />
        <Stat label="Payment cleared" value={inr(t.cleared)} tone="text-loom" />
        <Stat label="Expected from customers" value={inr(t.expected)} tone="text-thread" />
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <label className="flex items-center gap-1.5 text-sm">Beyond
          <input value={limit} inputMode="numeric" onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} onBlur={commitDays} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className="border border-line rounded-lg px-2 py-1.5 text-sm bg-white w-16 text-center outline-none focus:border-ink2" /> days
        </label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer…" className="border border-line rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-ink2 min-w-[160px] flex-1" />
        <button onClick={() => downloadPlanExcel({ rows, days }, `Payment_Plan_${days}d_${asOn}.xlsx`)} disabled={!rows.length} className="px-3 py-2 rounded-lg text-sm font-semibold border border-line hover:bg-paper disabled:opacity-40 flex items-center gap-1.5"><Download size={14} /> Excel</button>
        <button onClick={pdf} disabled={!rows.length || busy} className="bg-ink text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5"><FileText size={14} /> {busy ? "Preparing…" : "PDF for Mill"}</button>
      </div>
      <p className="text-xs text-muted">Enter payment cleared, payment expected (amount and date) and remarks — saved automatically. Bills under claim / difference are not included. Excel has the party-wise plan and a bill-wise sheet; both exports are as on {fmtDate(asOn)}.</p>
      <div className="hidden xl:grid gap-x-3 px-3 text-[10px] font-semibold uppercase tracking-wide text-muted" style={{ gridTemplateColumns: "minmax(150px,1.5fr) 96px 110px 128px 96px 110px 128px minmax(190px,2.2fr)" }}>
        <span>Customer</span><span className="text-right">Outstanding</span><span>Cleared (₹)</span><span>Cleared on</span><span className="text-right">Balance</span><span>Expected (₹)</span><span>Expected on</span><span>Remarks</span>
      </div>
      {!shown.length && <div className="bg-white border border-line rounded-xl p-8 text-center text-sm text-muted">{rows.length ? "No customer matches the search." : `No customer has outstanding beyond ${days} days.`}</div>}
      {shown.map((r) => <PlanRow key={r.key} r={r} days={days} onChange={onChange} />)}
    </div>
  );
}
