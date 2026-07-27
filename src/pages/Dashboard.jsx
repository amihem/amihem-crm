import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCustomers, useProducts, useTickets, useFollowUps } from "../context/domains.jsx";
import KpiCard from "../components/KpiCard.jsx";
import { StageBadge, PriorityBadge } from "../components/StatusBadge.jsx";
import { formatDate, isOverdue, isToday, daysBetween } from "../utils/helpers";
import { WON_STAGES, LOST_STAGES } from "../data/schema";

export default function Dashboard() {
  const { items: customers } = useCustomers();
  const { items: tickets } = useTickets();
  const { items: followups } = useFollowUps();

  const stats = useMemo(() => {
    const won = tickets.filter((t) => WON_STAGES.includes(t.stage));
    const lost = tickets.filter((t) => LOST_STAGES.includes(t.stage));
    const pendingSamples = tickets.filter((t) => !t.received);
    const decided = won.length + lost.length;
    const conversion = decided ? Math.round((won.length / decided) * 100) : 0;

    const todaysFollowups = followups.filter((f) => isToday(f.nextFollowUpDate));
    const overdueFollowups = followups.filter((f) => isOverdue(f.nextFollowUpDate));

    return { won, lost, pendingSamples, conversion, todaysFollowups, overdueFollowups };
  }, [tickets, followups]);

  const ticketById = (id) => tickets.find((t) => t.id === id);
  const customerByTicket = (ticketId) => {
    const t = ticketById(ticketId);
    return t ? customers.find((c) => c.id === t.customerId) : null;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display font-extrabold text-2xl">Dashboard</h1>
        <p className="text-muted text-sm mt-1">Follow-up discipline, at a glance.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Today's Follow-ups" value={stats.todaysFollowups.length} tone="thread" />
        <KpiCard label="Overdue Follow-ups" value={stats.overdueFollowups.length} tone="rust" />
        <KpiCard label="Pending Samples" value={stats.pendingSamples.length} tone="ink" />
        <KpiCard label="Conversion %" value={`${stats.conversion}%`} tone="loom" sub={`${stats.won.length} won · ${stats.lost.length} lost`} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Panel title="Overdue Follow-ups" empty="No overdue follow-ups — clean pipeline." accent="rust">
          {stats.overdueFollowups.map((f) => {
            const c = customerByTicket(f.ticketId);
            const t = ticketById(f.ticketId);
            return (
              <FollowUpRow key={f.id} f={f} c={c} t={t} overdueDays={daysBetween(f.nextFollowUpDate)} />
            );
          })}
        </Panel>

        <Panel title="Today's Follow-ups" empty="Nothing scheduled for today." accent="thread">
          {stats.todaysFollowups.map((f) => {
            const c = customerByTicket(f.ticketId);
            const t = ticketById(f.ticketId);
            return <FollowUpRow key={f.id} f={f} c={c} t={t} />;
          })}
        </Panel>
      </div>

      <Panel title="Recently Added Customers" empty="No customers yet.">
        {customers
          .slice()
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5)
          .map((c) => (
            <Link
              key={c.id}
              to="/customers"
              className="flex items-center justify-between py-2.5 border-b border-line last:border-0 hover:bg-paper -mx-2 px-2 rounded"
            >
              <div>
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs text-muted">{c.city} · {c.category}</div>
              </div>
              <span className="text-xs text-muted">{formatDate(c.createdAt)}</span>
            </Link>
          ))}
      </Panel>
    </div>
  );
}

const ACCENT_DOT = { rust: "bg-rust", thread: "bg-thread", loom: "bg-loom", ink: "bg-ink" };

function Panel({ title, children, empty, accent }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="bg-panel border border-line rounded-2xl p-4 sm:p-5">
      <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
        {accent && <span className={`w-1.5 h-1.5 rounded-full ${ACCENT_DOT[accent]}`} />}
        {title}
      </h3>
      {hasChildren ? (
        <div className="flex flex-col">{children}</div>
      ) : (
        <p className="text-sm text-muted py-2">{empty}</p>
      )}
    </div>
  );
}

function FollowUpRow({ f, c, t, overdueDays }) {
  return (
    <Link
      to="/tickets"
      className="flex items-center justify-between py-2.5 border-b border-line last:border-0 hover:bg-paper -mx-2 px-2 rounded gap-2"
    >
      <div className="min-w-0">
        <div className="font-medium text-sm truncate">{c?.name || "Unknown customer"}</div>
        <div className="text-xs text-muted truncate">{t?.ticketNumber} · {f.discussion}</div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <PriorityBadge priority={f.priority} />
        {overdueDays > 0 && <span className="text-xs text-rust font-medium">{overdueDays}d overdue</span>}
      </div>
    </Link>
  );
}
