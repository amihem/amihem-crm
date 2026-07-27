import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCustomers, useVisits } from "../context/domains.jsx";
import { formatDate } from "../utils/helpers";

export default function RoutePlanner() {
  const { items: customers } = useCustomers();
  const { items: visits, save } = useVisits();
  const [cityFilter, setCityFilter] = useState("");
  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10));

  const cities = useMemo(
    () => Array.from(new Set(customers.map((c) => c.city).filter(Boolean))).sort(),
    [customers]
  );

  const filtered = useMemo(
    () => customers.filter((c) => !cityFilter || c.city === cityFilter),
    [customers, cityFilter]
  );

  const todaysPlan = useMemo(
    () => visits.filter((v) => v.plannedDate === planDate),
    [visits, planDate]
  );
  const plannedIds = new Set(todaysPlan.map((v) => v.customerId));

  const addToRoute = async (customer) => {
    await save({ customerId: customer.id, plannedDate: planDate, visited: false });
  };

  const markVisited = async (visit) => {
    await save({ ...visit, visited: !visit.visited });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl">Route Planner</h1>
        <p className="text-muted text-sm mt-1">Group customers by city, plan the day's visits.</p>
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <Field label="Planning for">
          <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="border border-line rounded-lg px-3 py-2 text-sm bg-white" />
        </Field>
        <Field label="Filter by city">
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="border border-line rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All cities ({cities.length})</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      {todaysPlan.length > 0 && (
        <div className="bg-panel border border-line rounded-2xl p-4">
          <h3 className="font-display font-bold text-sm mb-3">Today's Route ({formatDate(planDate)}) — {todaysPlan.length} stops</h3>
          <div className="flex flex-col gap-2">
            {todaysPlan.map((v) => {
              const c = customers.find((cc) => cc.id === v.customerId);
              if (!c) return null;
              return (
                <div key={v.id} className="flex items-center justify-between border-b border-line last:border-0 py-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={v.visited} onChange={() => markVisited(v)} />
                    <span className={v.visited ? "line-through text-muted" : ""}>{c.name}</span>
                    <span className="text-xs text-muted">· {c.city}</span>
                  </label>
                  <Link to={`/customers/${c.id}`} className="text-xs text-ink2 font-semibold hover:underline">View</Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-display font-bold text-sm mb-3">
          {cityFilter || "All Customers"} ({filtered.length})
        </h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {filtered.map((c) => (
            <div key={c.id} className="bg-panel border border-line rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{c.name}</div>
                <div className="text-xs text-muted truncate">{c.city} · {c.buyerName}</div>
              </div>
              <button
                onClick={() => addToRoute(c)}
                disabled={plannedIds.has(c.id)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-ink text-white hover:bg-ink2 disabled:opacity-30 shrink-0"
              >
                {plannedIds.has(c.id) ? "Added" : "+ Add"}
              </button>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted py-4 col-span-full">No customers in this city yet.</p>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-ink/80">{label}</span>
      {children}
    </label>
  );
}
