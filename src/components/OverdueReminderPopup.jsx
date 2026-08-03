import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCustomers, useTickets, useFollowUps } from "../context/domains.jsx";
import { isOverdue, daysBetween } from "../utils/helpers";
import { buildWhatsAppLink, getTemplateMessage } from "../services/whatsapp";
import Modal from "./Modal.jsx";

const LAST_SHOWN_KEY = "amihem_crm_reminder_last_shown";

export default function OverdueReminderPopup() {
  const { items: customers } = useCustomers();
  const { items: tickets } = useTickets();
  const { items: followups } = useFollowUps();
  const [open, setOpen] = useState(false);

  const overdue = useMemo(
    () => followups
      .filter((f) => isOverdue(f.nextFollowUpDate))
      .sort((a, b) => daysBetween(b.nextFollowUpDate) - daysBetween(a.nextFollowUpDate)),
    [followups]
  );

  useEffect(() => {
    if (overdue.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const lastShown = localStorage.getItem(LAST_SHOWN_KEY);
    if (lastShown !== today) {
      setOpen(true);
      localStorage.setItem(LAST_SHOWN_KEY, today);
    }
    // Only check once when follow-up data first loads, not on every change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdue.length > 0]);

  const ticketById = (id) => tickets.find((t) => t.id === id);
  const customerByTicket = (ticketId) => {
    const t = ticketById(ticketId);
    return t ? customers.find((c) => c.id === t.customerId) : null;
  };

  if (overdue.length === 0) return null;

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={`${overdue.length} Overdue Follow-up${overdue.length > 1 ? "s" : ""}`}>
      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
        {overdue.slice(0, 10).map((f) => {
          const c = customerByTicket(f.ticketId);
          const t = ticketById(f.ticketId);
          const days = daysBetween(f.nextFollowUpDate);
          return (
            <div key={f.id} className="border border-line rounded-lg p-3 text-sm flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{c?.name || "Unknown customer"}</div>
                <div className="text-xs text-muted truncate">{t?.ticketNumber} · {f.discussion}</div>
                <div className="text-xs text-rust font-semibold mt-1">{days} day{days > 1 ? "s" : ""} overdue</div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {c?.phone && (
                  <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="text-xs font-semibold px-2 py-1 rounded-full bg-ink2/10 text-ink2 text-center">Call</a>
                )}
                {c?.whatsapp && (
                  <a
                    href={buildWhatsAppLink(c.whatsapp, getTemplateMessage("sampleReminder", c, t || {}))}
                    target="_blank" rel="noreferrer"
                    className="text-xs font-semibold px-2 py-1 rounded-full bg-loom/10 text-loom text-center"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {overdue.length > 10 && (
          <p className="text-xs text-muted text-center">+ {overdue.length - 10} more — see Dashboard for the full list.</p>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Link to="/" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink2">
          Go to Dashboard
        </Link>
      </div>
    </Modal>
  );
}
