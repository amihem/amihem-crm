// outstandingDrill.jsx — shared "bill-wise details" popup.
// Any report amount (month, financial year, ...) opens this with the bills behind that amount.
// Tapping a party name inside opens the full party detail on top (and closing it returns here).

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import Modal from "../components/Modal.jsx";
import { formatCurrency } from "../utils/helpers";
import { fmtDate, partyKey } from "../utils/outstanding";
import { DaysBadge, SortSelect } from "./outstandingReports.jsx";

export default function DrillModal({ drill, onClose, onOpenParty }) {
  const [sortId, setSortId] = useState("amt|-1");
  const groups = useMemo(() => {
    const m = new Map();
    drill.bills.forEach((b) => {
      if (!m.has(b.party)) m.set(b.party, { party: b.party, sum: 0, bills: [] });
      const g = m.get(b.party);
      g.sum += b.outstanding; g.bills.push(b);
    });
    return [...m.values()].map((g) => ({ ...g, bills: g.bills.sort((a, b) => a.date.localeCompare(b.date)) })).sort((a, b) => (sortId === "name|1" ? a.party.localeCompare(b.party) : sortId === "name|-1" ? b.party.localeCompare(a.party) : sortId === "amt|1" ? a.sum - b.sum : b.sum - a.sum));
  }, [drill, sortId]);
  const total = groups.reduce((s, g) => s + g.sum, 0);

  return (
    <Modal open onClose={onClose} title={drill.title} wide>
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-xs text-muted">{drill.bills.length} bill{drill.bills.length === 1 ? "" : "s"} · {groups.length} part{groups.length === 1 ? "y" : "ies"} · tap a party for full details</div>
          <div className="font-display font-extrabold text-2xl">₹{formatCurrency(total)}</div>
        </div>
        <SortSelect value={sortId} onChange={setSortId} options={[{ id: "amt|-1", label: "Amount — high to low" }, { id: "amt|1", label: "Amount — low to high" }, { id: "name|1", label: "Party A → Z" }, { id: "name|-1", label: "Party Z → A" }]} />
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.party} className="border border-line rounded-xl overflow-hidden">
              <button onClick={() => onOpenParty(partyKey(g.party))} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-paper/70 text-left hover:bg-paper">
                <span className="font-semibold text-sm leading-snug">{g.party}</span>
                <span className="flex items-center gap-1 font-bold text-sm whitespace-nowrap">₹{formatCurrency(g.sum)}<ChevronRight size={15} className="text-muted" /></span>
              </button>
              <div className="divide-y divide-line">
                {g.bills.map((b, i) => (
                  <div key={i} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{b.billNo}</div>
                      <div className="text-[11px] text-muted">{fmtDate(b.date)}</div>
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className={`font-semibold ${b.outstanding < 0 ? "text-loom" : ""}`}>{formatCurrency(b.outstanding)}</span>
                      {b.outstanding > 0 ? <DaysBadge days={b.days} /> : <span className="w-9" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
