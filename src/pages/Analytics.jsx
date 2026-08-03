import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { useCustomers, useProducts, useTickets } from "../context/domains.jsx";
import KpiCard from "../components/KpiCard.jsx";
import { WON_STAGES, LOST_STAGES } from "../data/schema";

const COLORS = ["#1B2340", "#C9862D", "#2F6E5D", "#B4453A", "#6B7280", "#2D3A6B"];

const RANGE_OPTIONS = ["All Time", "This Month", "Last 30 Days", "Last 90 Days", "Custom"];

function computeRange(rangeLabel, customFrom, customTo) {
  const now = new Date();
  if (rangeLabel === "This Month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  if (rangeLabel === "Last 30 Days") {
    const from = new Date(now); from.setDate(from.getDate() - 30);
    return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  if (rangeLabel === "Last 90 Days") {
    const from = new Date(now); from.setDate(from.getDate() - 90);
    return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  if (rangeLabel === "Custom") {
    return { from: customFrom || null, to: customTo || null };
  }
  return { from: null, to: null }; // All Time
}

export default function Analytics() {
  const { items: customers } = useCustomers();
  const { items: products } = useProducts();
  const { items: allTickets } = useTickets();
  const [rangeLabel, setRangeLabel] = useState("All Time");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const customerName = (id) => customers.find((c) => c.id === id)?.name || "Unknown";
  const productCategory = (id) => products.find((p) => p.id === id)?.category || "Unknown";

  const { from, to } = useMemo(() => computeRange(rangeLabel, customFrom, customTo), [rangeLabel, customFrom, customTo]);

  const tickets = useMemo(() => {
    if (!from && !to) return allTickets;
    return allTickets.filter((t) => {
      if (!t.date) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      return true;
    });
  }, [allTickets, from, to]);

  const overall = useMemo(() => {
    const won = tickets.filter((t) => WON_STAGES.includes(t.stage)).length;
    const lost = tickets.filter((t) => LOST_STAGES.includes(t.stage)).length;
    const pending = tickets.length - won - lost;
    const decided = won + lost;
    const conversion = decided ? Math.round((won / decided) * 100) : 0;
    return { won, lost, pending, conversion, total: tickets.length };
  }, [tickets]);

  const byStage = useMemo(() => {
    const map = {};
    tickets.forEach((t) => { map[t.stage] = (map[t.stage] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const byCity = useMemo(() => {
    const map = {};
    tickets.forEach((t) => {
      const city = customers.find((c) => c.id === t.customerId)?.city || "Unknown";
      if (!map[city]) map[city] = { city, won: 0, lost: 0, total: 0 };
      map[city].total += 1;
      if (WON_STAGES.includes(t.stage)) map[city].won += 1;
      if (LOST_STAGES.includes(t.stage)) map[city].lost += 1;
    });
    return Object.values(map);
  }, [tickets, customers]);

  const byProductCategory = useMemo(() => {
    const map = {};
    tickets.forEach((t) => {
      const cat = productCategory(t.productId);
      if (!map[cat]) map[cat] = { category: cat, won: 0, total: 0 };
      map[cat].total += 1;
      if (WON_STAGES.includes(t.stage)) map[cat].won += 1;
    });
    return Object.values(map);
  }, [tickets, products]);

  const byMonth = useMemo(() => {
    const map = {};
    tickets.forEach((t) => {
      const month = t.date?.slice(0, 7); // YYYY-MM
      if (!month) return;
      if (!map[month]) map[month] = { month, samples: 0, won: 0 };
      map[month].samples += 1;
      if (WON_STAGES.includes(t.stage)) map[month].won += 1;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [tickets]);

  const topCustomers = useMemo(() => {
    const map = {};
    tickets.forEach((t) => {
      const name = customerName(t.customerId);
      if (!map[name]) map[name] = { name, total: 0, won: 0 };
      map[name].total += 1;
      if (WON_STAGES.includes(t.stage)) map[name].won += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [tickets, customers]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Conversion Analytics</h1>
          <p className="text-muted text-sm mt-1">Where samples are converting — and where they're stuck.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={rangeLabel}
            onChange={(e) => setRangeLabel(e.target.value)}
            className="border border-line rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-ink2"
          >
            {RANGE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {rangeLabel === "Custom" && (
            <>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="border border-line rounded-lg px-2 py-2 text-sm bg-white outline-none focus:border-ink2" />
              <span className="text-muted text-sm">to</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="border border-line rounded-lg px-2 py-2 text-sm bg-white outline-none focus:border-ink2" />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Total Samples" value={overall.total} />
        <KpiCard label="Won" value={overall.won} tone="loom" />
        <KpiCard label="Lost" value={overall.lost} tone="rust" />
        <KpiCard label="Conversion %" value={`${overall.conversion}%`} tone="thread" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <ChartCard title="Tickets by Stage">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byStage} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                {byStage.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Sampling vs Won">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="samples" stroke="#1B2340" strokeWidth={2} />
              <Line type="monotone" dataKey="won" stroke="#2F6E5D" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="City-wise Conversion">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byCity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D6" />
              <XAxis dataKey="city" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="won" fill="#2F6E5D" />
              <Bar dataKey="lost" fill="#B4453A" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Product Category Conversion">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byProductCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D6" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="#1B2340" />
              <Bar dataKey="won" fill="#C9862D" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Top Customers by Sample Volume">
        <div className="flex flex-col gap-2">
          {topCustomers.map((c) => (
            <div key={c.name} className="flex items-center justify-between text-sm border-b border-line last:border-0 py-2">
              <span className="font-medium">{c.name}</span>
              <span className="text-muted">{c.won} won / {c.total} samples</span>
            </div>
          ))}
          {topCustomers.length === 0 && <p className="text-sm text-muted py-2">No data in this range.</p>}
        </div>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-panel border border-line rounded-2xl p-4 sm:p-5">
      <h3 className="font-display font-bold text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}
