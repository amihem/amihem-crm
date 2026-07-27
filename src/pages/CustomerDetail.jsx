import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useCustomers, useProducts, useTickets, useFollowUps, useCalls } from "../context/domains.jsx";
import { CustomerStatusBadge, StageBadge, TemperatureBadge } from "../components/StatusBadge.jsx";
import { formatDate } from "../utils/helpers";
import { scoreCustomer, scoreTemperature } from "../utils/scoring";
import { buildWhatsAppLink, getTemplateMessage, TEMPLATE_LABELS } from "../services/whatsapp";
import Modal from "../components/Modal.jsx";
import { Field, TextArea } from "../components/FormField.jsx";

export default function CustomerDetail() {
  const { id } = useParams();
  const { items: customers } = useCustomers();
  const { items: products } = useProducts();
  const { items: tickets } = useTickets();
  const { items: followups } = useFollowUps();
  const { items: calls, save: saveCall } = useCalls();
  const [loggingCall, setLoggingCall] = useState(false);

  const customer = customers.find((c) => c.id === id);
  const custTickets = useMemo(() => tickets.filter((t) => t.customerId === id), [tickets, id]);
  const ticketIds = useMemo(() => new Set(custTickets.map((t) => t.id)), [custTickets]);
  const custFollowUps = useMemo(() => followups.filter((f) => ticketIds.has(f.ticketId)), [followups, ticketIds]);
  const custCalls = useMemo(() => calls.filter((c) => c.customerId === id), [calls, id]);

  const score = useMemo(() => customer ? scoreCustomer(customer, tickets, followups) : 0, [customer, tickets, followups]);
  const temp = scoreTemperature(score);

  const timeline = useMemo(() => {
    const events = [];
    custTickets.forEach((t) => events.push({ type: "Sample", date: t.date, label: `${t.ticketNumber} — ${t.stage}`, detail: t.shade }));
    custFollowUps.forEach((f) => events.push({ type: "Follow-up", date: f.date, label: `${f.mode} — ${f.status}`, detail: f.discussion }));
    custCalls.forEach((c) => events.push({ type: "Call", date: c.date, label: `Call (${c.duration || "—"} min)`, detail: c.discussion }));
    return events.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [custTickets, custFollowUps, custCalls]);

  if (!customer) {
    return (
      <div className="text-center py-16">
        <p className="text-muted text-sm mb-3">Customer not found.</p>
        <Link to="/customers" className="text-ink2 text-sm font-semibold hover:underline">← Back to Customers</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/customers" className="text-xs text-muted hover:text-ink w-fit">← Back to Customers</Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-extrabold text-2xl">{customer.name}</h1>
            <CustomerStatusBadge status={customer.status} />
            <TemperatureBadge temp={temp} />
          </div>
          <p className="text-muted text-sm mt-1">
            {customer.city}{customer.state ? `, ${customer.state}` : ""} · {customer.buyerName} · Score: {score}
          </p>
        </div>
        <div className="flex gap-2">
          {customer.whatsapp && (
            <a
              href={buildWhatsAppLink(customer.whatsapp, getTemplateMessage("greeting", customer, {}))}
              target="_blank" rel="noreferrer"
              className="text-xs font-semibold px-3 py-2 rounded-lg bg-loom/10 text-loom border border-loom/30 hover:bg-loom/20"
            >
              WhatsApp
            </a>
          )}
          <button
            onClick={() => setLoggingCall(true)}
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-ink text-white hover:bg-ink2"
          >
            + Log Call
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Samples" value={custTickets.length} />
        <MiniStat label="Follow-ups" value={custFollowUps.length} />
        <MiniStat label="Calls" value={custCalls.length} />
      </div>

      <div>
        <h3 className="font-display font-bold text-sm mb-3">Timeline</h3>
        <div className="flex flex-col">
          {timeline.map((e, i) => (
            <div key={i} className="flex gap-3 py-3 border-b border-line last:border-0">
              <div className="w-16 shrink-0 text-xs text-muted pt-0.5">{formatDate(e.date)}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-thread">{e.type}</span>
                  <span className="text-sm font-medium">{e.label}</span>
                </div>
                {e.detail && <p className="text-xs text-muted mt-0.5">{e.detail}</p>}
              </div>
            </div>
          ))}
          {timeline.length === 0 && <p className="text-sm text-muted py-4">No activity logged yet.</p>}
        </div>
      </div>

      <Modal open={loggingCall} onClose={() => setLoggingCall(false)} title="Log Call">
        <CallForm
          customerId={id}
          onSave={async (form) => { await saveCall(form); setLoggingCall(false); }}
          onCancel={() => setLoggingCall(false)}
        />
      </Modal>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-panel border border-line rounded-xl p-3 text-center">
      <div className="font-display font-bold text-xl">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function CallForm({ customerId, onSave, onCancel }) {
  const [form, setForm] = useState({
    customerId,
    date: new Date().toISOString().slice(0, 10),
    duration: "",
    discussion: "",
    nextAction: "",
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="flex flex-col gap-3">
      <Field label="Date"><input type="date" value={form.date} onChange={set("date")} className="border border-line rounded-lg px-3 py-2 text-sm" /></Field>
      <Field label="Duration (minutes)"><input type="number" value={form.duration} onChange={set("duration")} className="border border-line rounded-lg px-3 py-2 text-sm" /></Field>
      <Field label="Discussion"><TextArea value={form.discussion} onChange={set("discussion")} required /></Field>
      <Field label="Next Action"><TextArea value={form.nextAction} onChange={set("nextAction")} rows={2} /></Field>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper">Cancel</button>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink2">Save Call</button>
      </div>
    </form>
  );
}
