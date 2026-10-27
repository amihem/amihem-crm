// outstandingTracker.jsx — "Payment Tracker": (1) payments we collected / advised that the
// supplier has not credited in the ledger yet, (2) accounts that have never been credited
// with any payment, each with a credit-risk rating.

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Ban, MessageCircle } from "lucide-react";
import { formatCurrency } from "../utils/helpers";
import { buildWhatsAppLink } from "../services/whatsapp";
import { creditStatus, hasNoPayment, riskOf, pickGroup, compactINR, todayIso, diffDays, fmtDate, exportExcel } from "../utils/outstanding";
import { ReportBar, Stat, DaysBadge, RiskBadge, SortSelect, savePdf } from "./outstandingReports.jsx";

const inr = (n) => `₹${formatCurrency(n)}`;
const WAIT_DAYS = 7; // a deposit older than this and still not credited needs a follow-up

export default function TrackerTab({ rows, rawGroups, coll, updateColl, settings, company, snap, showToast, onOpen }) {
  const [showAll, setShowAll] = useState(false);
  const [nsort, setNsort] = useState("overdue|-1");
  const today = todayIso();
  const profile = coll?.profile || {};

  // ---- A: collected but not credited ----
  const items = useMemo(() => (coll?.entries || []).map((e) => {
    const st = creditStatus(e, rawGroups);
    return { e, st, wait: Math.max(0, diffDays(today, e.depositDate)) };
  }).sort((a, b) => b.wait - a.wait), [coll, rawGroups, today]);
  const pending = items.filter((x) => x.st.status !== "credited");
  const pendAmt = pending.reduce((s, x) => s + x.e.amount, 0);
  const late = pending.filter((x) => x.wait > WAIT_DAYS);
  const shownItems = showAll ? items : pending;

  const markCredited = (e) => updateColl((c) => ({ ...c, entries: c.entries.map((x) => (x.id === e.id ? { ...x, credited: true } : x)) }));
  const remind = async () => {
    const lines = pending.map((x, i) => `${i + 1}. ${x.e.party} — ₹${formatCurrency(x.e.amount)} — ${x.e.mode} ${x.e.ref || ""} — deposited ${fmtDate(x.e.depositDate)}${x.e.advNo ? ` (Adv ${x.e.advNo})` : ""}`);
    const text = `Payments not yet credited in our ledger (as on ${fmtDate(today)}):\n\n${lines.join("\n")}\n\nTotal ₹${formatCurrency(pendAmt)}. Kindly credit and send the credit notes.\n\nRegards\n${profile.forLine || company}`;
    if (profile.supplierPhone) { const l = buildWhatsAppLink(profile.supplierPhone, text); if (!window.open(l, "_blank")) window.location.href = l; return; }
    try { await navigator.clipboard.writeText(text); showToast("Message copied — add the supplier's number in advice details (⚙) to send directly.", "info"); } catch { showToast("Couldn't copy.", "error"); }
  };

  // ---- B: accounts never credited with a payment ----
  const noPayBase = useMemo(() => rows.filter((r) => {
    const raw = pickGroup(rawGroups, r.g.name) || r.g;
    return r.g.due > 0 && hasNoPayment(raw);
  }).map((r) => ({ r, risk: riskOf(r.g, r.overdue, settings.creditDays) })).sort((a, b) => b.r.overdue - a.r.overdue || b.r.g.due - a.r.g.due), [rows, rawGroups, settings.creditDays]);
  const noPay = useMemo(() => {
    const [k, d] = nsort.split("|"), dir = Number(d);
    const v = (x) => (k === "name" ? x.r.g.name : k === "due" ? x.r.g.due : k === "oldest" ? x.r.g.oldest : x.r.overdue);
    return [...noPayBase].sort((a, b) => { const p = v(a), q = v(b); return (typeof p === "string" ? p.localeCompare(q) : p - q) * dir || b.r.g.due - a.r.g.due; });
  }, [noPayBase, nsort]);
  const noPayAmt = noPay.reduce((s, x) => s + x.r.g.due, 0);

  const cols = [{ key: "party", label: "Party" }, { key: "bills", label: "Bills" }, { key: "due", label: "Outstanding" }, { key: "overdue", label: "Overdue" }, { key: "oldest", label: "Oldest (days)" }, { key: "risk", label: "Risk" }];
  const data = () => noPay.map(({ r, risk }) => ({ party: r.g.name, bills: r.g.bills.length, due: r.g.due, overdue: r.overdue, oldest: r.g.oldest, risk }));
  const pdf = () => savePdf(`No_Payment_Accounts_${snap.asOn}.pdf`, {
    company, title: "Accounts with no payment credited", asOn: snap.asOn,
    kpis: [{ label: "Accounts", value: String(noPay.length) }, { label: "Outstanding", value: inr(noPayAmt) }, { label: "High risk", value: String(noPay.filter((x) => x.risk === "High").length), color: "#B4453A" }, { label: "Oldest bill", value: `${Math.max(0, ...noPay.map((x) => x.r.g.oldest))} days` }],
    head: ["Party", "Bills", "Outstanding", "Overdue", "Oldest (d)", "Risk"],
    body: data().map((d) => [d.party, d.bills, formatCurrency(d.due), formatCurrency(d.overdue), d.oldest, d.risk]),
    foot: ["TOTAL", "", formatCurrency(noPayAmt), formatCurrency(noPay.reduce((s, x) => s + x.r.overdue, 0)), "", ""],
    align: ["left", "center", "right", "right", "center", "center"],
  });

  const hasColl = (coll?.entries || []).length > 0;

  return (
    <div className="flex flex-col gap-6">
      {hasColl && (
        <section className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={Clock} label="Not credited" value={pending.length} sub={inr(pendAmt)} tone="text-thread" />
            <Stat icon={AlertTriangle} label={`Waiting > ${WAIT_DAYS}d`} value={late.length} sub={inr(late.reduce((s, x) => s + x.e.amount, 0))} tone="text-rust" />
            <Stat icon={CheckCircle2} label="Credited" value={items.length - pending.length} sub="matched in ledger" tone="text-loom" />
          </div>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-display font-bold text-base">Payments collected — credit pending</h3>
              <p className="text-xs text-muted mt-0.5">Matched with the latest ledger you uploaded (a receipt / credit of the same amount). Use “Mark credited” when you have confirmed it yourself.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAll(!showAll)} className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold hover:bg-paper">{showAll ? "Only pending" : "Show credited too"}</button>
              <button disabled={!pending.length} onClick={remind} className="px-3 py-1.5 rounded-lg bg-loom text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"><MessageCircle size={13} /> Remind supplier</button>
            </div>
          </div>
          {shownItems.map(({ e, st, wait }) => (
            <div key={e.id} className="bg-panel border border-line rounded-xl p-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-start">
              <div className="min-w-0">
                <div className="font-semibold text-sm leading-snug">{e.party}</div>
                <div className="text-xs text-muted mt-0.5">Deposited {fmtDate(e.depositDate)} · inv {e.invoices || "–"} · {e.mode}{e.ref ? ` · ${e.ref}` : ""}</div>
                <div className="text-[11px] mt-1 flex items-center gap-1.5 flex-wrap">
                  {st.status === "credited"
                    ? <span className="font-bold text-loom">✓ Credited{st.ref ? ` · ${st.ref}` : ""}{st.manual ? " (marked)" : ""}</span>
                    : <span className={`font-bold ${wait > WAIT_DAYS ? "text-rust" : "text-thread"}`}>{st.status === "unknown" ? "Party not found in ledger" : st.status === "verify" ? "Invoices not in ledger — verify" : "Not credited yet"} · {wait} day{wait === 1 ? "" : "s"}</span>}
                  <span className="text-muted">{e.advNo ? `Advice ${e.advNo}` : "Advice not issued"}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display font-bold whitespace-nowrap">{inr(e.amount)}</div>
                {st.status !== "credited" && <button onClick={() => markCredited(e)} className="mt-1 text-[11px] font-semibold text-ink2 underline">Mark credited</button>}
              </div>
            </div>
          ))}
          {!shownItems.length && <div className="text-center text-sm text-muted py-6 border border-dashed border-line rounded-xl">Every collected payment is credited 🎉</div>}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={Ban} label="Never paid" value={noPay.length} sub="accounts, no credit at all" tone="text-rust" />
          <Stat icon={AlertTriangle} label="Exposure" value={compactINR(noPayAmt)} sub={inr(noPayAmt)} />
          <Stat icon={Clock} label="High risk" value={noPay.filter((x) => x.risk === "High").length} sub="accounts" tone="text-rust" />
        </div>
        <ReportBar title="Accounts with no payment credited" note="Parties whose bills have not received any payment or advance in the ledger. Highest overdue first."
          onExcel={() => exportExcel(`No_Payment_Accounts_${snap.asOn}.xlsx`, "No payment", data(), cols)} onPdf={pdf} />
        <div className="flex justify-end"><SortSelect value={nsort} onChange={setNsort} options={[{ id: "overdue|-1", label: "Overdue — high to low" }, { id: "name|1", label: "Party A → Z" }, { id: "name|-1", label: "Party Z → A" }, { id: "due|-1", label: "Outstanding — high to low" }, { id: "oldest|-1", label: "Oldest bill first" }]} /></div>
        {noPay.map(({ r, risk }) => (
          <div key={r.g.key} className="bg-panel border border-line rounded-xl p-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-start">
            <div className="min-w-0">
              <button onClick={() => onOpen(r.g.key)} className="font-semibold text-sm text-left hover:underline leading-snug">{r.g.name}</button>
              <div className="text-xs text-muted mt-1 flex items-center gap-1.5 flex-wrap">{r.g.bills.length} bill{r.g.bills.length > 1 ? "s" : ""} · oldest <DaysBadge days={r.g.oldest} /> <RiskBadge level={risk} /></div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display font-bold whitespace-nowrap">{inr(r.g.due)}</div>
              {r.overdue > 0 && <div className="text-[11px] font-semibold text-rust whitespace-nowrap">{inr(r.overdue)} overdue</div>}
            </div>
          </div>
        ))}
        {!noPay.length && <div className="text-center text-sm text-muted py-6 border border-dashed border-line rounded-xl">Every account has received some payment.</div>}
      </section>
    </div>
  );
}
