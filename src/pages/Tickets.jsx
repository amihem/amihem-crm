import { useMemo, useState } from "react";
import { useCustomers, useProducts, useTickets, useFollowUps, useAttachments } from "../context/domains.jsx";
import Modal from "../components/Modal.jsx";
import { Field, TextInput, Select, TextArea } from "../components/FormField.jsx";
import { StageBadge, PriorityBadge } from "../components/StatusBadge.jsx";
import { formatDate, isOverdue, nextTicketNumber, daysBetween } from "../utils/helpers";
import { ticketProbability } from "../utils/scoring";
import { compressImage } from "../utils/image";
import { buildWhatsAppLink, getTemplateMessage, getMultiSampleReminderMessage, TEMPLATE_LABELS } from "../services/whatsapp";
import {
  SAMPLE_TYPE, DISPATCH_MODE, TICKET_STAGES, OPEN_STAGES, WON_STAGES, LOST_STAGES,
  FOLLOWUP_MODE, FOLLOWUP_PRIORITY, FOLLOWUP_STATUS,
} from "../data/schema";

export default function Tickets() {
  const { items: customers } = useCustomers();
  const { items: products } = useProducts();
  const { items: tickets, save: saveTicket } = useTickets();
  const { items: followups } = useFollowUps();
  const [stageFilter, setStageFilter] = useState("");
  const [queryFilter, setQueryFilter] = useState("open"); // open | closed | all
  const [newTicket, setNewTicket] = useState(null);
  const [openTicket, setOpenTicket] = useState(null);
  const [remindGroup, setRemindGroup] = useState(null); // { customer, tickets }

  const productName = (id) => products.find((p) => p.id === id)?.qualityName || "—";

  // "Last touched" = most recent follow-up date, or the ticket's own date
  // if no follow-up has ever been logged — this is what lets us flag a
  // query as going stale even if nobody set an explicit next-follow-up.
  const lastTouchedDate = (ticketId, ticketDate) => {
    const ticketFollowUps = followups.filter((f) => f.ticketId === ticketId);
    if (ticketFollowUps.length === 0) return ticketDate;
    return ticketFollowUps.reduce((latest, f) => (f.date > latest ? f.date : latest), ticketFollowUps[0].date);
  };

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchesStage = !stageFilter || t.stage === stageFilter;
      const matchesQuery =
        queryFilter === "all" ||
        (queryFilter === "open" && OPEN_STAGES.includes(t.stage)) ||
        (queryFilter === "closed" && !OPEN_STAGES.includes(t.stage));
      return matchesStage && matchesQuery;
    });
  }, [tickets, stageFilter, queryFilter]);

  // One row per CUSTOMER, with all their sample tickets nested inside —
  // a customer often gets several qualities sampled at once, so a flat
  // per-ticket list made it look like separate customers.
  const groupedByCustomer = useMemo(() => {
    const map = new Map();
    filtered.forEach((t) => {
      if (!map.has(t.customerId)) map.set(t.customerId, []);
      map.get(t.customerId).push(t);
    });
    return Array.from(map.entries())
      .map(([customerId, ticketsForCustomer]) => ({
        customer: customers.find((c) => c.id === customerId),
        tickets: ticketsForCustomer.sort((a, b) => new Date(b.date) - new Date(a.date)),
      }))
      .filter((g) => g.customer)
      .sort((a, b) => {
        if (queryFilter === "open") {
          // Most neglected (oldest last-touch) open query rises to the top
          const aOldest = Math.min(...a.tickets.map((t) => daysBetween(lastTouchedDate(t.id, t.date))));
          const bOldest = Math.min(...b.tickets.map((t) => daysBetween(lastTouchedDate(t.id, t.date))));
          return bOldest - aOldest;
        }
        return new Date(b.tickets[0].date) - new Date(a.tickets[0].date);
      });
  }, [filtered, customers, queryFilter]);

  const blankTicket = () => ({
    ticketNumber: nextTicketNumber(tickets),
    date: new Date().toISOString().slice(0, 10),
    customerId: customers[0]?.id || "",
    productId: products[0]?.id || "",
    shade: "", quantity: "", unit: "meters", sampleType: "Cutting",
    dispatchMode: "Courier", courierName: "", trackingNumber: "", courierCharges: "", podReceived: false,
    dispatchDate: "", expectedDelivery: "", received: false, garmentDeveloped: false,
    stage: "Sample Sent", remarks: "",
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Sample Management</h1>
          <p className="text-muted text-sm mt-1">{tickets.length} tickets</p>
        </div>
        <button
          onClick={() => setNewTicket(blankTicket())}
          disabled={!customers.length || !products.length}
          className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink2 transition disabled:opacity-40"
        >
          + New Sample Ticket
        </button>
      </div>
      {(!customers.length || !products.length) && (
        <p className="text-xs text-thread bg-thread/10 border border-thread/30 rounded-lg px-3 py-2">
          Add at least one customer and product before creating a ticket.
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-panel border border-line rounded-lg p-0.5 w-fit">
          {[
            { key: "open", label: "Open Queries" },
            { key: "closed", label: "Closed" },
            { key: "all", label: "All" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setQueryFilter(opt.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                queryFilter === opt.key ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="border border-line rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-ink2 w-fit"
        >
          <option value="">All stages</option>
          {TICKET_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {groupedByCustomer.map(({ customer, tickets: customerTickets }) => {
          const pendingCount = customerTickets.filter((t) => ["Sample Sent", "Received", "Testing", "Need Revised Sample"].includes(t.stage)).length;
          return (
            <div key={customer.id} className="bg-panel border border-line rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-display font-bold text-base">{customer.name}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {customer.city} · {customerTickets.length} sample{customerTickets.length > 1 ? "s" : ""}
                    {pendingCount > 0 && <span className="text-thread font-medium"> · {pendingCount} awaiting result</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {customer.phone && (
                    <a
                      href={`tel:${customer.phone.replace(/\D/g, "")}`}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-full bg-ink2/10 text-ink2 border border-ink2/30 hover:bg-ink2/20"
                    >
                      Call
                    </a>
                  )}
                  {customer.whatsapp && (
                    <button
                      onClick={() => setRemindGroup({ customer, tickets: customerTickets })}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-full bg-loom/10 text-loom border border-loom/30 hover:bg-loom/20"
                    >
                      Remind (WhatsApp)
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col divide-y divide-line -mx-1">
                {customerTickets.map((t) => {
                  const staleDays = daysBetween(lastTouchedDate(t.id, t.date));
                  const isOpenQuery = OPEN_STAGES.includes(t.stage);
                  const isStale = isOpenQuery && staleDays >= 7;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setOpenTicket(t)}
                      className={`text-left px-1 py-2.5 hover:bg-paper rounded-lg transition flex items-center justify-between gap-3 ${isStale ? "bg-rust/5" : ""}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted">{t.ticketNumber}</span>
                          <StageBadge stage={t.stage} />
                          {isStale && (
                            <span className="text-[10px] font-semibold text-rust bg-rust/10 border border-rust/30 rounded-full px-1.5 py-0.5">
                              No contact {staleDays}d
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium mt-0.5">{productName(t.productId)} · {t.shade}</div>
                        <div className="text-xs text-muted">{formatDate(t.date)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted uppercase tracking-wide">Probability</div>
                        <div className="font-display font-bold text-sm text-thread">{ticketProbability(t, followups)}%</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {groupedByCustomer.length === 0 && (
          <div className="text-center py-12 text-muted text-sm">No tickets in this stage.</div>
        )}
      </div>

      <Modal open={!!newTicket} onClose={() => setNewTicket(null)} title="New Sample Ticket" wide>
        {newTicket && (
          <TicketForm
            initial={newTicket}
            customers={customers}
            products={products}
            onSave={async (form) => { await saveTicket(form); setNewTicket(null); }}
            onCancel={() => setNewTicket(null)}
          />
        )}
      </Modal>

      <Modal open={!!openTicket} onClose={() => setOpenTicket(null)} title={openTicket?.ticketNumber} wide>
        {openTicket && (
          <TicketDetail
            ticket={tickets.find((t) => t.id === openTicket.id) || openTicket}
            customer={customers.find((c) => c.id === openTicket.customerId)}
            product={products.find((p) => p.id === openTicket.productId)}
            onUpdate={async (patch) => saveTicket({ ...openTicket, ...patch })}
          />
        )}
      </Modal>

      <Modal open={!!remindGroup} onClose={() => setRemindGroup(null)} title={`Remind ${remindGroup?.customer?.name || ""}`}>
        {remindGroup && (
          <ReminderPicker
            group={remindGroup}
            productName={productName}
            onClose={() => setRemindGroup(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function ReminderPicker({ group, productName, onClose }) {
  const { customer, tickets } = group;
  const PENDING_STAGES = ["Sample Sent", "Received", "Testing", "Need Revised Sample"];
  const [selected, setSelected] = useState(
    new Set(tickets.filter((t) => PENDING_STAGES.includes(t.stage)).map((t) => t.id))
  );

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectedTickets = tickets.filter((t) => selected.has(t.id));

  const send = () => {
    if (selectedTickets.length === 0) return;
    const message = getMultiSampleReminderMessage(customer, selectedTickets);
    window.open(buildWhatsAppLink(customer.whatsapp, message), "_blank");
    onClose();
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">Pick which samples to ask feedback on — this builds one WhatsApp message listing just those.</p>
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {tickets.map((t) => (
          <label key={t.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-paper text-sm">
            <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{productName(t.productId)} {t.shade && `· ${t.shade}`}</div>
              <div className="text-xs text-muted">{t.ticketNumber} · {t.stage}</div>
            </div>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-1">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper">Cancel</button>
        <button
          onClick={send}
          disabled={selectedTickets.length === 0}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-loom text-white hover:opacity-90 disabled:opacity-40"
        >
          Send via WhatsApp ({selectedTickets.length})
        </button>
      </div>
    </div>
  );
}

function TicketForm({ initial, customers, products, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setBool = (k) => (e) => setForm({ ...form, [k]: e.target.checked });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="grid sm:grid-cols-2 gap-3">
      <Field label="Customer *">
        <Select required options={customers.map((c) => c.name)} value={customers.find(c=>c.id===form.customerId)?.name || ""}
          onChange={(e) => setForm({ ...form, customerId: customers.find(c => c.name === e.target.value)?.id })} />
      </Field>
      <Field label="Product *">
        <Select required options={products.map((p) => p.qualityName)} value={products.find(p=>p.id===form.productId)?.qualityName || ""}
          onChange={(e) => setForm({ ...form, productId: products.find(p => p.qualityName === e.target.value)?.id })} />
      </Field>
      <Field label="Shade"><TextInput value={form.shade} onChange={set("shade")} /></Field>
      <Field label="Quantity"><TextInput value={form.quantity} onChange={set("quantity")} /></Field>
      <Field label="Sample Type">
        <Select options={SAMPLE_TYPE} value={form.sampleType} onChange={set("sampleType")} />
      </Field>
      <Field label="Dispatch Mode">
        <Select options={DISPATCH_MODE} value={form.dispatchMode} onChange={set("dispatchMode")} />
      </Field>
      {form.dispatchMode === "Courier" && (
        <>
          <Field label="Courier Name"><TextInput value={form.courierName} onChange={set("courierName")} /></Field>
          <Field label="Tracking Number"><TextInput value={form.trackingNumber} onChange={set("trackingNumber")} /></Field>
          <Field label="Courier Charges (₹)"><TextInput value={form.courierCharges} onChange={set("courierCharges")} /></Field>
          <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={form.podReceived} onChange={setBool("podReceived")} /> POD received</label>
        </>
      )}
      <Field label="Dispatch Date"><TextInput type="date" value={form.dispatchDate} onChange={set("dispatchDate")} /></Field>
      <Field label="Expected Delivery"><TextInput type="date" value={form.expectedDelivery} onChange={set("expectedDelivery")} /></Field>
      <Field label="Stage">
        <Select options={TICKET_STAGES} value={form.stage} onChange={set("stage")} />
      </Field>
      <div className="flex items-center gap-4 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.received} onChange={setBool("received")} /> Received by customer</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.garmentDeveloped} onChange={setBool("garmentDeveloped")} /> Garment developed</label>
      </div>
      <Field label="Remarks" className="sm:col-span-2"><TextArea value={form.remarks} onChange={set("remarks")} /></Field>

      <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper">Cancel</button>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink2">Create Ticket</button>
      </div>
    </form>
  );
}

function TicketDetail({ ticket, customer, product, onUpdate }) {
  const { items: allFollowUps, save: saveFollowUp } = useFollowUps();
  const { items: allAttachments, save: saveAttachment, remove: removeAttachment } = useAttachments();
  const [addingFollowUp, setAddingFollowUp] = useState(false);
  const [waTemplate, setWaTemplate] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [closureNote, setClosureNote] = useState(ticket.closureNote || "");
  const [orderValue, setOrderValue] = useState(ticket.orderValue || "");

  const followUps = allFollowUps
    .filter((f) => f.ticketId === ticket.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const attachments = allAttachments
    .filter((a) => a.ticketId === ticket.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const handleUpload = async (e, label) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      await saveAttachment({ ticketId: ticket.id, label, dataUrl });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const probability = ticketProbability(ticket, allFollowUps);
  const isTerminalStage = WON_STAGES.includes(ticket.stage) || LOST_STAGES.includes(ticket.stage);
  const isWon = WON_STAGES.includes(ticket.stage);

  const handleStageChange = (stage) => {
    // Moving into a terminal stage doesn't auto-close — the person still
    // fills in the closure note below and hits "Close Query" so there's
    // always a recorded reason, not just a silent dropdown change.
    onUpdate({ stage });
  };

  const closeQuery = () => {
    onUpdate({
      closureNote,
      orderValue: isWon ? orderValue : "",
      closedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-sm font-semibold">{customer?.name}</span>
          <span className="text-xs text-muted"> · {product?.qualityName} · {ticket.shade}</span>
        </div>
        {!isTerminalStage && (
          <div className="text-right">
            <div className="text-xs text-muted">Order probability</div>
            <div className="font-display font-bold text-lg text-thread">{probability}%</div>
          </div>
        )}
        {isTerminalStage && (
          <span className={`text-xs font-semibold rounded-full px-2.5 py-1 border ${isWon ? "bg-loom/10 text-loom border-loom/30" : "bg-rust/10 text-rust border-rust/30"}`}>
            {ticket.closedAt ? "Query Closed" : "Needs Closure Note"}
          </span>
        )}
      </div>

      {(ticket.courierName || ticket.trackingNumber) && (
        <div className="text-xs text-muted bg-paper border border-line rounded-lg px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
          {ticket.courierName && <span>Courier: {ticket.courierName}</span>}
          {ticket.trackingNumber && <span>Tracking: {ticket.trackingNumber}</span>}
          {ticket.courierCharges && <span>Charges: ₹{ticket.courierCharges}</span>}
          <span>POD: {ticket.podReceived ? "Received" : "Pending"}</span>
        </div>
      )}

      <Field label="Stage">
        <Select options={TICKET_STAGES} value={ticket.stage} onChange={(e) => handleStageChange(e.target.value)} />
      </Field>

      {isTerminalStage && (
        <div className={`border rounded-lg p-3 flex flex-col gap-2 ${isWon ? "border-loom/30 bg-loom/5" : "border-rust/30 bg-rust/5"}`}>
          <div className="text-xs font-semibold">{isWon ? "Order won — close this query" : "Sample didn't convert — record why"}</div>
          {isWon && (
            <Field label="Order Value (₹, optional)">
              <TextInput type="number" value={orderValue} onChange={(e) => setOrderValue(e.target.value)} placeholder="e.g. 45000" />
            </Field>
          )}
          <Field label={isWon ? "Notes (quantity, terms, etc.)" : "Reason (shade/price/quality/timing…)"}>
            <TextArea value={closureNote} onChange={(e) => setClosureNote(e.target.value)} rows={2} />
          </Field>
          <button
            onClick={closeQuery}
            className={`self-start text-xs font-semibold px-3 py-1.5 rounded-full text-white ${isWon ? "bg-loom" : "bg-rust"} hover:opacity-90`}
          >
            {ticket.closedAt ? "Update Closure" : "Close Query"}
          </button>
          {ticket.closedAt && (
            <div className="text-[10px] text-muted">Closed {formatDate(ticket.closedAt)}</div>
          )}
        </div>
      )}

      {customer?.phone && (
        <a
          href={`tel:${customer.phone.replace(/\D/g, "")}`}
          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-ink2/10 text-ink2 border border-ink2/30 hover:bg-ink2/20 w-fit"
        >
          Call {customer.buyerName || customer.name}
        </a>
      )}

      {customer?.whatsapp && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
            <a
              key={key}
              href={buildWhatsAppLink(customer.whatsapp, getTemplateMessage(key, customer, ticket))}
              target="_blank" rel="noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-loom/10 text-loom border border-loom/30 hover:bg-loom/20"
            >
              {label} ↗
            </a>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-display font-bold text-sm">Follow-ups ({followUps.length})</h4>
          <button onClick={() => setAddingFollowUp(true)} className="text-xs font-semibold text-ink2 hover:underline">
            + Add Follow-up
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {followUps.map((f) => (
            <div key={f.id} className="border border-line rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-muted">{formatDate(f.date)} · {f.mode}</span>
                <div className="flex gap-1.5">
                  <PriorityBadge priority={f.priority} />
                  {isOverdue(f.nextFollowUpDate) && (
                    <span className="text-xs font-semibold text-rust bg-rust/10 border border-rust/30 rounded-full px-2 py-0.5">Overdue</span>
                  )}
                </div>
              </div>
              <p className="mt-1.5">{f.discussion}</p>
              <div className="text-xs text-muted mt-1.5">
                Status: {f.status} {f.nextFollowUpDate && `· Next: ${formatDate(f.nextFollowUpDate)}`}
              </div>
            </div>
          ))}
          {followUps.length === 0 && !addingFollowUp && (
            <p className="text-sm text-muted py-2">No follow-ups logged yet — add the first one.</p>
          )}
          {addingFollowUp && (
            <FollowUpForm
              ticketId={ticket.id}
              onSave={async (f) => { await saveFollowUp(f); setAddingFollowUp(false); }}
              onCancel={() => setAddingFollowUp(false)}
            />
          )}
        </div>
      </div>

      <div>
        <h4 className="font-display font-bold text-sm mb-2">Photos ({attachments.length})</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          <UploadButton label="Garment Photo" onChange={(e) => handleUpload(e, "Garment Photo")} uploading={uploading} />
          <UploadButton label="Dispatch Photo" onChange={(e) => handleUpload(e, "Dispatch Photo")} uploading={uploading} />
          <UploadButton label="Other" onChange={(e) => handleUpload(e, "Other")} uploading={uploading} />
        </div>
        {attachments.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {attachments.map((a) => (
              <div key={a.id} className="relative group">
                <img src={a.dataUrl} alt={a.label} className="w-full aspect-square object-cover rounded-lg border border-line" />
                <div className="absolute inset-x-0 bottom-0 bg-ink/70 text-white text-[10px] px-1.5 py-1 rounded-b-lg truncate">{a.label}</div>
                <button
                  onClick={() => { if (confirm("Remove this photo?")) removeAttachment(a.id); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadButton({ label, onChange, uploading }) {
  return (
    <label className="text-xs font-semibold px-3 py-1.5 rounded-full bg-panel border border-line hover:bg-paper cursor-pointer">
      {uploading ? "Uploading…" : `+ ${label}`}
      <input type="file" accept="image/*" capture="environment" onChange={onChange} disabled={uploading} className="hidden" />
    </label>
  );
}

function FollowUpForm({ ticketId, onSave, onCancel }) {
  const [form, setForm] = useState({
    ticketId,
    date: new Date().toISOString().slice(0, 10),
    time: "",
    mode: "Phone",
    discussion: "",
    nextFollowUpDate: "",
    priority: "Medium",
    status: "Waiting",
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="grid sm:grid-cols-2 gap-3 border border-line rounded-lg p-3">
      <Field label="Date"><TextInput type="date" value={form.date} onChange={set("date")} /></Field>
      <Field label="Mode"><Select options={FOLLOWUP_MODE} value={form.mode} onChange={set("mode")} /></Field>
      <Field label="Discussion" className="sm:col-span-2"><TextArea value={form.discussion} onChange={set("discussion")} required /></Field>
      <Field label="Next Follow-up Date"><TextInput type="date" value={form.nextFollowUpDate} onChange={set("nextFollowUpDate")} /></Field>
      <Field label="Priority"><Select options={FOLLOWUP_PRIORITY} value={form.priority} onChange={set("priority")} /></Field>
      <Field label="Status" className="sm:col-span-2"><Select options={FOLLOWUP_STATUS} value={form.status} onChange={set("status")} /></Field>
      <div className="sm:col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted hover:bg-paper">Cancel</button>
        <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-ink text-white hover:bg-ink2">Save Follow-up</button>
      </div>
    </form>
  );
}
