// outstandingInsights.jsx — "Insights" tab: charts and plain-language takeaways built from the
// uploaded outstanding report, earlier uploads (history), weekly collections and open claims.

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, LineChart, Line, Legend,
} from "recharts";
import { Lightbulb } from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";
import { formatCurrency } from "../utils/helpers";
import {
  BUCKETS, bucketOf, groupParties, overdueAmount, compactINR, summarizeSnapshot, weekStartIso, fmtDate,
} from "../utils/outstanding";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const inr = (n) => `₹${formatCurrency(n)}`;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
// short axis labels: ₹30L, ₹7.5L, ₹50K, ₹1.2Cr
const axisINR = (n) => {
  const t = (v) => String(Math.round(v * 10) / 10).replace(/\.0$/, "");
  if (n >= 1e7) return `₹${t(n / 1e7)}Cr`;
  if (n >= 1e5) return `₹${t(n / 1e5)}L`;
  if (n >= 1e3) return `₹${t(n / 1e3)}K`;
  return n === 0 ? "0" : `₹${n}`;
};
const short = (s, n = 18) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const GREEN = "#2F6E5D";
const RED = "#B4453A";
const AMBER = "#C9862D";
const NAVY = "#1B2340";
const MODE_COLORS = ["#1B2340", "#2F6E5D", "#C9862D", "#B4453A", "#6B7280", "#7A9A4E"];

function ChartCard({ title, sub, children, wide = false }) {
  return (
    <div className={`bg-white border border-line rounded-xl p-3 sm:p-4 ${wide ? "lg:col-span-2" : ""}`}>
      <div className="mb-2">
        <div className="text-sm font-display font-bold">{title}</div>
        {sub && <div className="text-[11px] text-muted mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export default function InsightsTab({ snap, history = [], settings, coll, claims = [], source }) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const credit = settings.creditDays;
  const axis = { fill: dark ? "#9AA1B4" : "#6B7280", fontSize: 11 };
  const grid = dark ? "rgba(255,255,255,0.08)" : "rgba(150,160,180,0.25)";
  const tip = {
    contentStyle: { borderRadius: 10, border: `1px solid ${grid}`, background: dark ? "#1D2233" : "#FFFFFF", color: dark ? "#EDEDF2" : NAVY, fontSize: 12 },
    cursor: { fill: dark ? "rgba(255,255,255,0.05)" : "rgba(27,35,64,0.05)" },
    formatter: (v) => inr(v),
  };

  const d = useMemo(() => {
    const groups = groupParties(snap.bills);
    const live = snap.bills.filter((b) => b.outstanding > 0);
    const total = live.reduce((s, b) => s + b.outstanding, 0);
    const overdue = live.reduce((s, b) => (b.days > credit ? s + b.outstanding : s), 0);
    const buckets = BUCKETS.map((b) => ({ label: b.label, color: b.color, amount: groups.reduce((t, g) => t + g.buckets[b.key], 0) }));
    const over90 = buckets.slice(3).reduce((s, b) => s + b.amount, 0) + buckets[2].amount * 0; // 91+ days
    const avgAge = total ? Math.round(live.reduce((s, b) => s + b.outstanding * b.days, 0) / total) : 0;
    const oldest = [...live].sort((a, b) => b.days - a.days)[0];

    const parties = groups
      .filter((g) => g.total > 0)
      .map((g) => { const od = overdueAmount(g, credit); return { name: g.name, label: short(g.name), total: g.total, overdue: od, current: g.total - od }; })
      .sort((a, b) => b.total - a.total);
    const top = parties.slice(0, 10);
    const top3 = parties.slice(0, 3).reduce((s, p) => s + p.total, 0);

    const mm = new Map();
    live.forEach((b) => {
      const k = b.date.slice(0, 7);
      if (!mm.has(k)) mm.set(k, { key: k, amount: 0, wd: 0 });
      const r = mm.get(k); r.amount += b.outstanding; r.wd += b.outstanding * b.days;
    });
    const months = [...mm.values()].sort((a, b) => a.key.localeCompare(b.key)).map((r) => {
      const [y, mo] = r.key.split("-").map(Number);
      return { label: `${MONTHS[mo - 1]} ${String(y).slice(2)}`, amount: r.amount, color: bucketOf(Math.round(r.wd / r.amount)).color };
    });

    const cur = summarizeSnapshot(snap);
    const trend = [...history, cur].filter((h, i, a) => a.findIndex((x) => x.asOn === h.asOn) === i)
      .sort((a, b) => a.asOn.localeCompare(b.asOn))
      .map((h) => ({ label: fmtDate(h.asOn).slice(0, 6), Net: Math.round(h.net), Overdue: Math.round(h.due) }));
    const prev = history.length ? history[history.length - 1] : null;

    // collections (weekly, last 12 weeks) + mode split
    const entries = coll?.entries || [];
    const wk = new Map();
    entries.forEach((e) => { const k = weekStartIso(e.depositDate); wk.set(k, (wk.get(k) || 0) + e.amount); });
    const weeks = [...wk.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, v]) => ({ label: fmtDate(k).slice(0, 6), amount: v }));
    const md = new Map();
    entries.forEach((e) => md.set(e.mode || "—", (md.get(e.mode || "—") || 0) + e.amount));
    const modes = [...md.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const last4 = weeks.slice(-4);
    const perWeek = last4.length ? last4.reduce((s, w) => s + w.amount, 0) / last4.length : 0;

    // claims
    const ct = new Map();
    claims.forEach((c) => ct.set(c.type, (ct.get(c.type) || 0) + (Number(c.amount) || 0)));
    const claimTypes = [...ct.entries()].map(([name, value]) => ({ name, value }));
    const claimTotal = claimTypes.reduce((s, c) => s + c.value, 0);

    return { groups, total, overdue, buckets, over90, avgAge, oldest, parties, top, top3, months, trend, prev, cur, weeks, modes, perWeek, claimTypes, claimTotal, nBills: live.length };
  }, [snap, history, coll, claims, credit]);

  if (!d.total && !d.claimTotal) return <div className="bg-white border border-line rounded-xl p-8 text-center text-sm text-muted">No outstanding bills to chart.</div>;

  const insights = [];
  insights.push(`Net outstanding ${inr(d.total)} across ${d.parties.length} parties and ${d.nBills} bills; average bill age ${d.avgAge} days.`);
  if (d.total) insights.push(`${pct(d.overdue, d.total)}% (${compactINR(d.overdue)}) is past the ${credit}-day credit period, and ${compactINR(d.over90)} (${pct(d.over90, d.total)}%) is older than 90 days.`);
  if (d.parties.length) insights.push(`Top 3 parties hold ${pct(d.top3, d.total)}% of the dues — ${d.parties[0].name} alone owes ${compactINR(d.parties[0].total)} (${pct(d.parties[0].total, d.total)}%).`);
  if (d.oldest) insights.push(`Oldest unpaid bill: ${d.oldest.party}, ${d.oldest.billNo} — ${d.oldest.days} days (${inr(d.oldest.outstanding)}).`);
  if (d.prev) {
    const diff = d.cur.net - d.prev.net;
    insights.push(`Since the report of ${fmtDate(d.prev.asOn)}, net outstanding ${diff >= 0 ? "went up" : "came down"} by ${compactINR(Math.abs(diff))}.`);
  }
  if (source === "ranjan" && d.perWeek > 0 && d.overdue > 0) insights.push(`Collections of the last ${Math.min(4, d.weeks.length)} week(s) average ${compactINR(d.perWeek)} per week — at this pace the overdue amount would take about ${Math.ceil(d.overdue / d.perWeek)} weeks to clear.`);
  if (d.claimTotal) insights.push(`${compactINR(d.claimTotal)} is under claim / difference with the mill and is kept out of the overdue chase.`);

  const barH = (n) => Math.max(180, n * 30 + 30);

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white border border-line rounded-xl p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2"><Lightbulb size={16} className="text-thread" /><span className="text-sm font-display font-bold">Key insights</span></div>
        <ul className="flex flex-col gap-1.5 text-[13px] leading-snug">
          {insights.map((t, i) => <li key={i} className="flex gap-2"><span className="text-thread">•</span><span>{t}</span></li>)}
        </ul>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <ChartCard title="Ageing of outstanding" sub="Amount by bill age (days)">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={d.buckets} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={axisINR} />
              <Tooltip {...tip} />
              <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                {d.buckets.map((b) => <Cell key={b.label} fill={b.color} />)}
                <LabelList dataKey="amount" position="top" formatter={compactINR} style={{ fill: axis.fill, fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Within credit vs overdue" sub={`Credit period ${credit} days`}>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={[{ name: "Within credit", value: Math.max(0, d.total - d.overdue) }, { name: "Overdue", value: d.overdue }]} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                <Cell fill={GREEN} /><Cell fill={RED} />
              </Pie>
              <Tooltip {...tip} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <text x="50%" y="46%" textAnchor="middle" style={{ fill: dark ? "#EDEDF2" : NAVY, fontSize: 18, fontWeight: 700 }}>{pct(d.overdue, d.total)}%</text>
              <text x="50%" y="55%" textAnchor="middle" style={{ fill: axis.fill, fontSize: 11 }}>overdue</text>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 parties by outstanding" sub="Overdue part in red, within-credit part in green" wide>
          <ResponsiveContainer width="100%" height={barH(d.top.length)}>
            <BarChart data={d.top} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={grid} horizontal={false} />
              <XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={axisINR} />
              <YAxis type="category" dataKey="label" tick={axis} tickLine={false} axisLine={false} width={120} />
              <Tooltip {...tip} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="overdue" name="Overdue" stackId="a" fill={RED} />
              <Bar dataKey="current" name="Within credit" stackId="a" fill={GREEN} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Outstanding by invoice month" sub="Colour shows the average age of that month's bills">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={d.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={axisINR} />
              <Tooltip {...tip} />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>{d.months.map((m, i) => <Cell key={i} fill={m.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Trend across uploaded reports" sub="Net outstanding and overdue on each report date">
          {d.trend.length < 2 ? (
            <div className="h-[230px] flex items-center justify-center text-xs text-muted text-center px-6">The trend builds up as you upload new reports — upload the next one to see the line.</div>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={d.trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={axisINR} />
                <Tooltip {...tip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Net" stroke={NAVY === "#1B2340" && dark ? "#9DB4FF" : NAVY} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Overdue" stroke={RED} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {d.weeks.length > 0 && (
          <ChartCard title="Collections per week" sub="Payments recorded (Tuesday → Monday weeks), last 12 weeks">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={d.weeks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={axisINR} />
                <Tooltip {...tip} />
                <Bar dataKey="amount" fill={GREEN} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {d.modes.length > 0 && (
          <ChartCard title="Collections by payment mode" sub="All recorded payments">
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie data={d.modes} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2} stroke="none">
                  {d.modes.map((m, i) => <Cell key={m.name} fill={MODE_COLORS[i % MODE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...tip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {d.claimTypes.length > 0 && (
          <ChartCard title="Claims / differences by type" sub="Open items, kept out of the overdue chase">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={d.claimTypes} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={42} tickFormatter={axisINR} />
                <Tooltip {...tip} />
                <Bar dataKey="value" fill={AMBER} radius={[8, 8, 0, 0]}>
                  <LabelList dataKey="value" position="top" formatter={compactINR} style={{ fill: axis.fill, fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </div>
  );
}
