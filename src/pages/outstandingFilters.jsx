// outstandingFilters.jsx — one filter bar shared by the report tabs:
// party-wise, overdue-amount-wise and higher-outstanding-wise.

import { useMemo, useState } from "react";
import { SlidersHorizontal, X, Search } from "lucide-react";
import Modal from "../components/Modal.jsx";
import { compactINR } from "../utils/outstanding";

export const EMPTY_FILTERS = { parties: null, minOverdue: 0, minOutstanding: 0, topN: 0 };

export const filtersActive = (f) => !!(f.parties || f.minOverdue || f.minOutstanding || f.topN);

export function applyFilters(rows, f) {
  let r = rows;
  if (f.parties) { const set = new Set(f.parties); r = r.filter((x) => set.has(x.g.name)); }
  if (f.minOverdue) r = r.filter((x) => x.overdue >= f.minOverdue);
  if (f.minOutstanding) r = r.filter((x) => x.g.total >= f.minOutstanding);
  if (f.topN) r = [...r].sort((a, b) => b.g.total - a.g.total).slice(0, f.topN);
  return r;
}

export function filterNote(f) {
  const bits = [];
  if (f.parties) bits.push(`${f.parties.length} selected part${f.parties.length === 1 ? "y" : "ies"}`);
  if (f.minOverdue) bits.push(`Overdue ≥ Rs. ${compactINR(f.minOverdue, false)}`);
  if (f.minOutstanding) bits.push(`Outstanding ≥ Rs. ${compactINR(f.minOutstanding, false)}`);
  if (f.topN) bits.push(`Top ${f.topN} by outstanding`);
  return bits.join(" · ");
}

const OD = [0, 50000, 100000, 500000, 1000000];
const OS = [0, 100000, 500000, 1000000, 2500000];
const TOP = [0, 5, 10, 20];
const chip = (on) => `px-3 py-1.5 rounded-full text-xs font-semibold border transition ${on ? "bg-ink text-white border-ink" : "border-line hover:bg-paper"}`;

export default function ReportFilters({ names, value, onChange, shown, total }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(false);
  const active = filtersActive(value);
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="bg-panel border border-line rounded-xl">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold">
        <SlidersHorizontal size={15} /> Filters
        {active && <span className="text-[10px] font-bold bg-ink text-white rounded-full px-2 py-0.5">ON</span>}
        <span className="ml-auto text-xs font-medium text-muted">{shown} of {total} parties</span>
      </button>
      {(open || active) && (
        <div className="px-3.5 pb-3.5 flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wide w-full sm:w-28">Party</span>
            <button onClick={() => setPick(true)} className={chip(!!value.parties)}>{value.parties ? `${value.parties.length} selected` : "All parties"} ▾</button>
            {value.parties && <button onClick={() => set({ parties: null })} className="text-xs font-semibold text-muted underline">clear</button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wide w-full sm:w-28">Overdue amount ≥</span>
            {OD.map((v) => <button key={v} onClick={() => set({ minOverdue: v })} className={chip(value.minOverdue === v)}>{v ? compactINR(v) : "Any"}</button>)}
            <input inputMode="numeric" placeholder="custom ₹" value={OD.includes(value.minOverdue) ? "" : value.minOverdue}
              onChange={(e) => set({ minOverdue: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="border border-line rounded-full px-3 py-1.5 text-xs w-24 bg-white outline-none focus:border-ink2" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wide w-full sm:w-28">Outstanding ≥</span>
            {OS.map((v) => <button key={v} onClick={() => set({ minOutstanding: v })} className={chip(value.minOutstanding === v)}>{v ? compactINR(v) : "Any"}</button>)}
            <input inputMode="numeric" placeholder="custom ₹" value={OS.includes(value.minOutstanding) ? "" : value.minOutstanding}
              onChange={(e) => set({ minOutstanding: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="border border-line rounded-full px-3 py-1.5 text-xs w-24 bg-white outline-none focus:border-ink2" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wide w-full sm:w-28">Highest outstanding</span>
            {TOP.map((v) => <button key={v} onClick={() => set({ topN: v })} className={chip(value.topN === v)}>{v ? `Top ${v}` : "All"}</button>)}
          </div>
          {active && <button onClick={() => onChange(EMPTY_FILTERS)} className="self-start flex items-center gap-1 text-xs font-semibold text-rust"><X size={13} /> Reset all filters</button>}
        </div>
      )}
      {pick && <PartyPicker names={names} selected={value.parties} onApply={(p) => { set({ parties: p }); setPick(false); }} onClose={() => setPick(false)} />}
    </div>
  );
}

function PartyPicker({ names, selected, onApply, onClose }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(new Set(selected || []));
  const list = useMemo(() => names.filter((n) => n.toLowerCase().includes(q.toLowerCase())), [names, q]);
  const toggle = (n) => setSel((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  return (
    <Modal open onClose={onClose} title="Select parties" wide>
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search party…" className="border border-line rounded-lg pl-9 pr-3 py-2 text-sm bg-white w-full outline-none focus:border-ink2" />
        </div>
        <div className="flex gap-3 text-xs font-semibold">
          <button onClick={() => setSel(new Set([...sel, ...list]))} className="text-ink2 underline">Select shown ({list.length})</button>
          <button onClick={() => setSel(new Set())} className="text-muted underline">Clear</button>
          <span className="ml-auto text-muted">{sel.size} selected</span>
        </div>
        <div className="border border-line rounded-xl max-h-[50vh] overflow-y-auto divide-y divide-line">
          {list.map((n) => (
            <label key={n} className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-paper/60">
              <input type="checkbox" className="w-4 h-4" checked={sel.has(n)} onChange={() => toggle(n)} /> {n}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold border border-line hover:bg-paper">Cancel</button>
          <button onClick={() => onApply(sel.size ? [...sel] : null)} className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold">Apply</button>
        </div>
      </div>
    </Modal>
  );
}
