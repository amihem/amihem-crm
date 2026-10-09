// outstandingCollections.jsx — record payments collected against the outstanding
// (Tuesday → Monday weeks) and issue the weekly Payment Advice to the supplier.

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Settings2, FileText, Download, MessageCircle, Wallet, CheckCircle2, Clock } from "lucide-react";
import Modal from "../components/Modal.jsx";
import KpiCard from "../components/KpiCard.jsx";
import { downloadBlob } from "../utils/helpers";
import { buildWhatsAppLink } from "../services/whatsapp";
import { uploadStatement } from "../services/outstandingSync";
import { shareStatementFile } from "../utils/statementImage";
import { weekStartIso, addDaysIso, weekLabel, shortInv, todayIso, fmtDate } from "../utils/outstanding";
import { DEFAULT_ADVICE_PROFILE, buildAdvicePages, advicePdfBlob, adviceCanvas, adviceTotals, inFmt, dmyFull } from "../utils/advicePdf";

const MODES = ["CHQ", "NEFT", "RTGS", "IMPS", "UPI", "CASH"];
const inr = (n) => `₹${inFmt(n)}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const field = "border border-line rounded-lg px-3 py-2 text-sm bg-white w-full outline-none focus:border-ink2";
const lab = "text-[11px] font-semibold text-muted uppercase tracking-wide";
const num = (v) => (v === "" || v == null ? 0 : Number(v) || 0);

export default function CollectionsTab({ groups, coll, updateColl, company, showToast }) {
  const profile = { ...DEFAULT_ADVICE_PROFILE, ...(coll.profile || {}) };
  const [week, setWeek] = useState(() => weekStartIso(todayIso()));
  const [allWeeks, setAllWeeks] = useState(false);
  const [form, setForm] = useState(null); // null | {} (new) | entry (edit)
  const [off, setOff] = useState(new Set());
  const [advice, setAdvice] = useState(null); // { draft?:true, advice }
  const [profOpen, setProfOpen] = useState(false);

  const pending = coll.entries.filter((e) => !e.advNo);
  const inWeek = (e) => weekStartIso(e.depositDate) === week;
  const visible = allWeeks ? pending : pending.filter(inWeek);
  const chosen = visible.filter((e) => !off.has(e.id));
  const weekTotal = coll.entries.filter(inWeek).reduce((s, e) => s + e.amount, 0);
  const pendingTotal = pending.reduce((s, e) => s + e.amount, 0);
  const lastAdv = [...coll.advices].sort((a, b) => b.no - a.no)[0];

  const grouped = useMemo(() => {
    const m = new Map();
    visible.forEach((e) => { const k = weekStartIso(e.depositDate); if (!m.has(k)) m.set(k, []); m.get(k).push(e); });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  const saveEntry = (e) => {
    updateColl((c) => ({ ...c, entries: c.entries.some((x) => x.id === e.id) ? c.entries.map((x) => (x.id === e.id ? e : x)) : [...c.entries, e] }));
    setForm(null);
    showToast("Collection recorded");
  };
  const delEntry = (e) => {
    if (!window.confirm(`Delete ${e.party} — ${inr(e.amount)}?`)) return;
    updateColl((c) => ({ ...c, entries: c.entries.filter((x) => x.id !== e.id) }));
  };
  const issue = (draft) => {
    const adv = { no: draft.no, date: draft.date, rows: draft.rows, total: adviceTotals(draft.rows).amount, createdAt: new Date().toISOString() };
    updateColl((c) => ({
      ...c,
      advices: [...c.advices.filter((a) => a.no !== adv.no), adv],
      nextAdvNo: Math.max(c.nextAdvNo || 0, adv.no + 1),
      entries: c.entries.map((e) => (draft.rows.some((r) => r.id === e.id) ? { ...e, advNo: adv.no } : e)),
    }));
    setAdvice({ advice: adv });
    showToast(`Payment Advice ${adv.no} issued`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="This week" value={inr(weekTotal)} icon={Wallet} sub={weekLabel(week)} />
        <KpiCard label="Advice pending" value={inr(pendingTotal)} tone="thread" icon={Clock} sub={`${pending.length} payment${pending.length === 1 ? "" : "s"}`} />
        <KpiCard label="Last advice" value={lastAdv ? `No. ${lastAdv.no}` : "–"} tone="loom" icon={CheckCircle2} sub={lastAdv ? `${dmyFull(lastAdv.date)} · ${inr(lastAdv.total)}` : "none yet"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setForm({})} className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"><Plus size={15} /> Record collection</button>
        <button disabled={!chosen.length} onClick={() => setAdvice({ draft: true, rows: chosen })} className="bg-loom text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-40"><FileText size={15} /> Prepare advice ({chosen.length})</button>
        <button onClick={() => setProfOpen(true)} className="p-2 rounded-lg border border-line hover:bg-paper ml-auto" aria-label="Advice details"><Settings2 size={16} /></button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button disabled={allWeeks} onClick={() => setWeek(addDaysIso(week, -7))} className="p-2 rounded-lg border border-line hover:bg-paper disabled:opacity-30" aria-label="Previous week"><ChevronLeft size={15} /></button>
        <div className="text-sm font-semibold min-w-[170px] text-center">{allWeeks ? "All weeks" : weekLabel(week)}</div>
        <button disabled={allWeeks} onClick={() => setWeek(addDaysIso(week, 7))} className="p-2 rounded-lg border border-line hover:bg-paper disabled:opacity-30" aria-label="Next week"><ChevronRight size={15} /></button>
        <button onClick={() => { setAllWeeks(false); setWeek(weekStartIso(todayIso())); }} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-line hover:bg-paper">This week</button>
        <button onClick={() => setAllWeeks(!allWeeks)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${allWeeks ? "bg-ink text-white border-ink" : "border-line hover:bg-paper"}`}>All pending</button>
      </div>

      {grouped.map(([wk, list]) => (
        <div key={wk} className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center justify-between">
            <span>{weekLabel(wk)}</span>
            <span>{inr(list.reduce((s, e) => s + e.amount, 0))}</span>
          </div>
          {list.map((e) => (
            <div key={e.id} className="bg-panel border border-line rounded-xl p-3 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 items-start">
              <input type="checkbox" className="w-4 h-4 mt-1" checked={!off.has(e.id)} onChange={() => setOff((s) => { const n = new Set(s); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n; })} />
              <div className="min-w-0">
                <div className="font-semibold text-sm leading-snug">{e.party}</div>
                <div className="text-xs text-muted mt-0.5">{dmyFull(e.depositDate)} · inv {e.invoices || "–"} · {e.mode}{e.ref ? ` · ${e.ref}` : ""}</div>
                {(e.cd > 0 || e.gr > 0 || e.freight > 0) && <div className="text-[11px] text-muted mt-0.5">Bill {inr(e.billAmt)}{e.cd ? ` · CD ${inr(e.cd)}` : ""}{e.gr ? ` · GR ${inr(e.gr)}` : ""}{e.freight ? ` · Freight ${inr(e.freight)}` : ""}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="font-display font-bold text-base whitespace-nowrap">{inr(e.amount)}</div>
                <div className="flex justify-end gap-1 mt-1">
                  <button onClick={() => setForm(e)} className="p-1.5 rounded-md border border-line hover:bg-paper" aria-label="Edit"><Pencil size={13} /></button>
                  <button onClick={() => delEntry(e)} className="p-1.5 rounded-md border border-line hover:bg-paper text-rust" aria-label="Delete"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
      {!grouped.length && (
        <div className="text-center text-sm text-muted py-8 border border-dashed border-line rounded-xl">
          {pending.length ? "No pending payments in this week — use “All pending” to see older ones." : "No collections waiting for an advice. Tap “Record collection” to add one."}
        </div>
      )}

      {coll.advices.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <div className="text-xs font-semibold text-muted uppercase tracking-wide">Advices issued</div>
          {[...coll.advices].sort((a, b) => b.no - a.no).map((a) => (
            <button key={a.no} onClick={() => setAdvice({ advice: a })} className="bg-panel border border-line rounded-xl px-3 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-paper/60">
              <div>
                <div className="font-semibold text-sm">Advice No. {a.no}</div>
                <div className="text-xs text-muted">{dmyFull(a.date)} · {a.rows.length} payment{a.rows.length === 1 ? "" : "s"}</div>
              </div>
              <div className="font-display font-bold whitespace-nowrap">{inr(a.total)}</div>
            </button>
          ))}
        </div>
      )}

      {form && <CollectionForm groups={groups} entry={form.id ? form : null} onSave={saveEntry} onClose={() => setForm(null)} />}
      {advice && <AdviceModal key={advice.advice?.no || "draft"} state={advice} coll={coll} profile={profile} company={company} onIssue={issue} onClose={() => setAdvice(null)} showToast={showToast} />}
      {profOpen && <ProfileModal profile={profile} onSave={(p) => { updateColl((c) => ({ ...c, profile: p })); setProfOpen(false); }} onClose={() => setProfOpen(false)} />}
    </div>
  );
}

// ---------------- record / edit a collection ----------------
function CollectionForm({ groups, entry, onSave, onClose }) {
  const names = useMemo(() => groups.map((g) => g.name).sort((a, b) => a.localeCompare(b)), [groups]);
  const [f, setF] = useState(() => entry ? {
    party: entry.party, depositDate: entry.depositDate, invoices: entry.invoices, invDate: entry.invDate,
    billAmt: entry.billAmt, pct: entry.pct, cd: entry.cd, gr: entry.gr, freight: entry.freight, amount: entry.amount, ref: entry.ref, mode: entry.mode,
  } : { party: "", depositDate: todayIso(), invoices: "", invDate: "", billAmt: "", pct: 0, cd: "", gr: "", freight: "", amount: "", ref: "", mode: "CHQ" });
  const [touched, setTouched] = useState(entry ? { billAmt: true, cd: true, amount: true } : {});
  const [picked, setPicked] = useState(new Set());
  const [other, setOther] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const touch = (k, v) => { set(k, v); setTouched((t) => ({ ...t, [k]: true })); };

  const bills = useMemo(() => (groups.find((g) => g.name === f.party)?.bills || []).filter((b) => b.outstanding > 0).sort((a, b) => a.date.localeCompare(b.date)), [groups, f.party]);
  const togglePick = (b) => {
    const n = new Set(picked);
    n.has(b.billNo) ? n.delete(b.billNo) : n.add(b.billNo);
    setPicked(n);
    const sel = bills.filter((x) => n.has(x.billNo));
    set("invoices", sel.map((x) => shortInv(x.billNo)).join(","));
    set("invDate", sel.length ? sel.reduce((m, x) => (x.date > m ? x.date : m), "") : "");
    if (!touched.billAmt) set("billAmt", sel.reduce((s, x) => s + x.outstanding, 0) || "");
  };

  const bill = num(f.billAmt);
  const cd = touched.cd ? num(f.cd) : Math.round((bill * num(f.pct)) / 100);
  const amount = touched.amount ? num(f.amount) : Math.max(0, bill - cd - num(f.gr) - num(f.freight));
  const ok = f.party.trim() && f.depositDate && amount > 0;

  const save = () => onSave({
    id: entry?.id || uid(), advNo: entry?.advNo || null, createdAt: entry?.createdAt || new Date().toISOString(),
    party: f.party.trim(), depositDate: f.depositDate, invoices: f.invoices.trim(), invDate: f.invDate, billAmt: bill, pct: num(f.pct),
    cd, gr: num(f.gr), freight: num(f.freight), amount, ref: f.ref.trim(), mode: f.mode,
  });

  return (
    <Modal open onClose={onClose} title={entry ? "Edit collection" : "Record collection"} wide>
      <div className="flex flex-col gap-3">
        <div>
          <label className={lab}>Party</label>
          {other ? (
            <input className={`${field} mt-1`} placeholder="Party name" value={f.party} onChange={(e) => set("party", e.target.value)} />
          ) : (
            <select className={`${field} mt-1`} value={f.party} onChange={(e) => { if (e.target.value === "__other") { setOther(true); set("party", ""); } else { set("party", e.target.value); setPicked(new Set()); } }}>
              <option value="">Select party…</option>
              {names.map((n) => <option key={n} value={n}>{n}</option>)}
              <option value="__other">Other (type name)…</option>
            </select>
          )}
        </div>
        {bills.length > 0 && (
          <div>
            <label className={lab}>Tap the bills paid</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {bills.map((b) => (
                <button key={b.billNo + b.date} onClick={() => togglePick(b)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold text-left ${picked.has(b.billNo) ? "bg-ink text-white border-ink" : "border-line hover:bg-paper"}`}>
                  {shortInv(b.billNo)} <span className="opacity-70 font-medium">· {inr(b.outstanding)} · {b.days}d</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lab}>Deposit date</label><input type="date" className={`${field} mt-1`} value={f.depositDate} onChange={(e) => set("depositDate", e.target.value)} /></div>
          <div><label className={lab}>Invoice date</label><input type="date" className={`${field} mt-1`} value={f.invDate} onChange={(e) => set("invDate", e.target.value)} /></div>
        </div>
        <div><label className={lab}>Invoice nos.</label><input className={`${field} mt-1`} placeholder="e.g. 1413,1414,1611" value={f.invoices} onChange={(e) => set("invoices", e.target.value)} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={lab}>Bill amt ₹</label><input inputMode="decimal" className={`${field} mt-1`} value={f.billAmt} onChange={(e) => touch("billAmt", e.target.value)} /></div>
          <div><label className={lab}>% less</label><input inputMode="decimal" className={`${field} mt-1`} value={f.pct} onChange={(e) => set("pct", e.target.value)} /></div>
          <div><label className={lab}>CD ₹</label><input inputMode="decimal" className={`${field} mt-1`} value={touched.cd ? f.cd : cd || ""} onChange={(e) => touch("cd", e.target.value)} /></div>
          <div><label className={lab}>GR ₹</label><input inputMode="decimal" className={`${field} mt-1`} value={f.gr} onChange={(e) => set("gr", e.target.value)} /></div>
          <div><label className={lab}>Freight (last GR) ₹</label><input inputMode="decimal" className={`${field} mt-1`} value={f.freight} onChange={(e) => set("freight", e.target.value)} /></div>
          <div><label className={lab}>Amount received ₹</label><input inputMode="decimal" className={`${field} mt-1 font-bold`} value={touched.amount ? f.amount : amount || ""} onChange={(e) => touch("amount", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div><label className={lab}>Chq no. / Tran ID</label><input className={`${field} mt-1`} value={f.ref} onChange={(e) => set("ref", e.target.value)} /></div>
          <div><label className={lab}>Mode</label>
            <select className={`${field} mt-1`} value={f.mode} onChange={(e) => set("mode", e.target.value)}>{MODES.map((m) => <option key={m}>{m}</option>)}</select>
          </div>
        </div>
        <p className="text-[11px] text-muted">Amount = Bill − CD − GR − Freight unless you type it yourself.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border border-line hover:bg-paper">Cancel</button>
          <button disabled={!ok} onClick={save} className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40">Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- prepare / view a payment advice ----------------
function AdviceModal({ state, coll, profile, company, onIssue, onClose, showToast }) {
  const draft = !!state.draft;
  const [no, setNo] = useState(draft ? coll.nextAdvNo || 1 : state.advice.no);
  const [date, setDate] = useState(draft ? todayIso() : state.advice.date);
  const rows = draft ? state.rows : state.advice.rows;
  const adv = useMemo(() => ({ no: Number(no) || 0, date, rows }), [no, date, rows]);
  const [imgs, setImgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const tot = adviceTotals(rows);
  const fileName = `Payment_Advice_${adv.no}.pdf`;

  useEffect(() => {
    const pages = buildAdvicePages(adv, profile);
    setImgs(pages.map((ops) => adviceCanvas(ops, 1.5).toDataURL("image/png")));
  }, [adv, profile]);

  const pdf = () => advicePdfBlob(buildAdvicePages(adv, profile));
  const text = `Payment Advice No. ${adv.no} dated ${dmyFull(adv.date)} — ${inr(tot.amount)} (${rows.length} payment${rows.length === 1 ? "" : "s"}).\\n\\nRegards\\n${profile.forLine || company}`;
  const save = async () => downloadBlob(fileName, await pdf());
  const share = async () => {
    const res = await shareStatementFile(await pdf(), fileName, profile.supplierPhone, text);
    if (res === "downloaded") showToast(profile.supplierPhone ? "Saved — attach it in the WhatsApp chat that opened" : "Saved to your device", "info");
  };
  const link = async () => {
    if (!profile.supplierPhone) { showToast("Add the supplier's WhatsApp number in advice details (⚙).", "error"); return; }
    setBusy(true);
    try {
      const url = await uploadStatement(await pdf(), fileName);
      const l = buildWhatsAppLink(profile.supplierPhone, `${text}\\n\\nPayment Advice (PDF): ${url}`);
      if (!window.open(l, "_blank")) window.location.href = l;
    } catch (e) {
      showToast("Couldn't create the link — run supabase/outstanding.sql once, then retry.", "error");
    } finally { setBusy(false); }
  };
  const btn = "px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40";

  return (
    <Modal open onClose={onClose} title={draft ? "Prepare Payment Advice" : `Payment Advice No. ${adv.no}`} wide>
      <div className="flex flex-col gap-3">
        {draft && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lab}>Advice no.</label><input inputMode="numeric" className={`${field} mt-1`} value={no} onChange={(e) => setNo(e.target.value)} /></div>
            <div><label className={lab}>Date</label><input type="date" className={`${field} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
        )}
        <div className="border border-line rounded-xl bg-paper overflow-auto max-h-[52vh] flex flex-col gap-2 p-1">
          {imgs.map((u, i) => <img key={i} src={u} alt={`Advice page ${i + 1}`} className="min-w-[640px] w-full block bg-white" />)}
        </div>
        <div className="text-xs text-muted flex justify-between flex-wrap gap-1">
          <span>{rows.length} payment{rows.length === 1 ? "" : "s"} · Bill {inr(tot.bill)} · CD {inr(tot.cd)}</span>
          <b className="text-ink">Net {inr(tot.amount)}</b>
        </div>
        {draft ? (
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border border-line hover:bg-paper">Cancel</button>
            <button disabled={!adv.no} onClick={() => onIssue(adv)} className="bg-loom text-white px-4 py-2 rounded-lg text-sm font-semibold">Issue advice No. {adv.no}</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={link} className={`${btn} bg-loom text-white col-span-2`}><MessageCircle size={15} /> {busy ? "Preparing…" : `Send to supplier on WhatsApp${profile.supplierPhone ? ` (${profile.supplierPhone})` : ""}`}</button>
            <button onClick={save} className={`${btn} border border-line hover:bg-paper`}><Download size={15} /> Save PDF</button>
            <button onClick={share} className={`${btn} border border-line hover:bg-paper`}><FileText size={15} /> Share PDF file</button>
          </div>
        )}
        {draft && <p className="text-[11px] text-muted">Issuing marks these payments as advised and moves the next advice number forward. You can send or re-download it afterwards from “Advices issued”.</p>}
      </div>
    </Modal>
  );
}

// ---------------- advice header details ----------------
function ProfileModal({ profile, onSave, onClose }) {
  const [p, setP] = useState({ ...profile, supplierLines: profile.supplierLines.join("\n"), senderLines: profile.senderLines.join("\n") });
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const save = () => onSave({
    ...p,
    supplierLines: p.supplierLines.split("\n").map((s) => s.trim()).filter(Boolean),
    senderLines: p.senderLines.split("\n").map((s) => s.trim()).filter(Boolean),
  });
  return (
    <Modal open onClose={onClose} title="Payment advice details" wide>
      <div className="flex flex-col gap-3">
        <div><label className={lab}>Sender name (top, centre)</label><input className={`${field} mt-1`} value={p.senderName} onChange={(e) => set("senderName", e.target.value)} /></div>
        <div><label className={lab}>Sender address / contact (one line each)</label><textarea rows={4} className={`${field} mt-1`} value={p.senderLines} onChange={(e) => set("senderLines", e.target.value)} /></div>
        <div><label className={lab}>Supplier name</label><input className={`${field} mt-1`} value={p.supplierName} onChange={(e) => set("supplierName", e.target.value)} /></div>
        <div><label className={lab}>Supplier address (one line each)</label><textarea rows={2} className={`${field} mt-1`} value={p.supplierLines} onChange={(e) => set("supplierLines", e.target.value)} /></div>
        <div><label className={lab}>Bank line (“…deposited Payments to your ___”)</label><input className={`${field} mt-1`} value={p.bank} onChange={(e) => set("bank", e.target.value)} /></div>
        <div><label className={lab}>Signature line</label><input className={`${field} mt-1`} value={p.forLine} onChange={(e) => set("forLine", e.target.value)} /></div>
        <div><label className={lab}>Closing note</label><input className={`${field} mt-1`} value={p.note} onChange={(e) => set("note", e.target.value)} /></div>
        <div><label className={lab}>Supplier WhatsApp number (to send the advice)</label><input inputMode="tel" className={`${field} mt-1`} placeholder="10-digit number" value={p.supplierPhone} onChange={(e) => set("supplierPhone", e.target.value)} /></div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border border-line hover:bg-paper">Cancel</button>
          <button onClick={save} className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold">Save</button>
        </div>
      </div>
    </Modal>
  );
}
