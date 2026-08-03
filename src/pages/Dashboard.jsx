import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCustomers, useProducts, useTickets, useFollowUps, useInventory } from "../context/domains.jsx";
import KpiCard from "../components/KpiCard.jsx";
import { StageBadge, PriorityBadge } from "../components/StatusBadge.jsx";
import { formatDate, isOverdue, isToday, daysBetween } from "../utils/helpers";
import { buildWhatsAppLink, getTemplateMessage } from "../services/whatsapp";
import { WON_STAGES, LOST_STAGES, LOW_STOCK_THRESHOLD, OPEN_STAGES } from "../data/schema";

export default function Dashboard() {
  const { items: customers } = useCustomers();
  const { items: products } = useProducts();
  const { items: tickets } = useTickets();
  const { items: followups } = useFollowUps();
  const { items: inventory } = useInventory();

  const lowStockItems = useMemo(
    () => inventory.filter((i) => Number(i.quantity) <= LOW_STOCK_THRESHOLD),
    [inventory]
  );
  const productName = (id) => products.find((p) => p.id === id)?.qualityName || "—";

  const stats = useMemo(() => {
    const won = tickets.filter((t) => WON_STAGES.includes(t.stage));
    const lost = tickets.filter((t) => LOST_STAGES.includes(t.stage));
    const pendingSamples = tickets.filter((t) => !t.received);
    const decided = won.length + lost.length;
    const conversion = decided ? Math.round((won.length / decided) * 100) : 0;

    const todaysFollowups = followups.filter((f) => isToday(f.nextFollowUpDate));
    const overdueFollowups = followups.filter((f) => isOverdue(f.nextFollowUpDate));

    // Open queries nobody has touched in 7+ days — catches samples that
    // never had a next-follow-up date set at all, not just ones that did.
    const staleOpenTickets = tickets
      .filter((t) => OPEN_STAGES.includes(t.stage))
      .map((t) => {
        const ticketFollowUps = followups.filter((f) => f.ticketId === t.id);
        const lastTouch = ticketFollowUps.length
          ? ticketFollowUps.reduce((latest, f) => (f.date > latest ? f.date : latest), ticketFollowUps[0].date)
          : t.date;
        return { ticket: t, days: daysBetween(lastTouch) };
      })
      .filter((x) => x.days >= 7)
      .sort((a, b) => b.days - a.days);

    return { won, lost, pendingSamples, conversion, todaysFollowups, overdueFollowups, staleOpenTickets };
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

      {stats.staleOpenTickets.length > 0 && (
        <Panel title="Open Queries Going Stale (7+ days, no contact)" accent="rust">
          {stats.staleOpenTickets.slice(0, 8).map(({ ticket: t, days }) => {
            const c = customers.find((cc) => cc.id === t.customerId);
            return (
              <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-line last:border-0 gap-2">
                <Link to="/tickets" className="min-w-0 flex-1 hover:bg-paper -mx-2 px-2 py-1 rounded">
                  <div className="font-medium text-sm truncate">{c?.name || "Unknown customer"}</div>
                  <div className="text-xs text-muted truncate">{t.ticketNumber} · {productName(t.productId)} · {t.stage}</div>
                </Link>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-rust font-semibold">{days}d</span>
                  {c?.phone && (
                    <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="w-7 h-7 flex items-center justify-center rounded-full bg-ink2/10 text-ink2 text-xs">☎</a>
                  )}
                  {c?.whatsapp && (
                    <a
                      href={buildWhatsAppLink(c.whatsapp, getTemplateMessage("sampleReminder", c, t))}
                      target="_blank" rel="noreferrer"
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-loom/10 text-loom text-xs"
                    >
                      ✆
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </Panel>
      )}

      {lowStockItems.length > 0 && (
        <Panel title="Low Stock — Fabric Book & Hangers" accent="rust">
          {lowStockItems.map((i) => (
            <Link
              key={i.id}
              to="/inventory"
              className="flex items-center justify-between py-2.5 border-b border-line last:border-0 hover:bg-paper -mx-2 px-2 rounded"
            >
              <div>
                <div className="font-medium text-sm">{productName(i.productId)}</div>
                <div className="text-xs text-muted">{i.itemType}{i.shade ? ` · ${i.shade}` : ""}{i.location ? ` · ${i.location}` : ""}</div>
              </div>
              <span className="text-xs font-semibold text-rust">{i.quantity} left</span>
            </Link>
          ))}
        </Panel>
      )}

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
    <div className="flex items-center justify-between py-2.5 border-b border-line last:border-0 gap-2">
      <Link
        to="/tickets"
        className="min-w-0 flex-1 hover:bg-paper -mx-2 px-2 py-1 rounded"
      >
        <div className="font-medium text-sm truncate">{c?.name || "Unknown customer"}</div>
        <div className="text-xs text-muted truncate">{t?.ticketNumber} · {f.discussion}</div>
      </Link>
      <div className="flex items-center gap-1.5 shrink-0">
        <PriorityBadge priority={f.priority} />
        {overdueDays > 0 && <span className="text-xs text-rust font-medium">{overdueDays}d</span>}
        {c?.phone && (
          <a
            href={`tel:${c.phone.replace(/\D/g, "")}`}
            title="Call"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-ink2/10 text-ink2 hover:bg-ink2/20 text-xs"
          >
            ☎
          </a>
        )}
        {c?.whatsapp && (
          <a
            href={buildWhatsAppLink(c.whatsapp, getTemplateMessage("sampleReminder", c, t || {}))}
            target="_blank" rel="noreferrer"
            title="WhatsApp reminder"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-loom/10 text-loom hover:bg-loom/20 text-xs"
          >
            ✆
          </a>
        )}
      </div>
    </div>
  );
}
