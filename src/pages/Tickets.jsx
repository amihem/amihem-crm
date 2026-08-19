import { RefreshCw, MessageCircle, Phone, CheckCircle2, Pencil, Trash2, Search, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useCustomers, useProducts, useTickets, useFollowUps, useAttachments } from "../context/domains.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import Modal from "../components/Modal.jsx";
import EntitySearchField from "../components/EntitySearchField.jsx";
import CustomerForm, { BLANK_CUSTOMER } from "../components/CustomerForm.jsx";
import ProductForm, { BLANK_PRODUCT } from "../components/ProductForm.jsx";
import { Field, TextInput, Select, TextArea } from "../components/FormField.jsx";
import { StageBadge, PriorityBadge } from "../components/StatusBadge.jsx";
import { formatDate, isOverdue, nextTicketNumbers, daysBetween, newId } from "../utils/helpers";
import { ticketProbability } from "../utils/scoring";
import { compressImage } from "../utils/image";
import { buildWhatsAppLink, getTemplateMessage, getMultiSampleReminderMessage, TEMPLATE_LABELS } from "../services/whatsapp";
import {
  SAMPLE_TYPE, DISPATCH_MODE, TICKET_STAGES, OPEN_STAGES, WON_STAGES, LOST_STAGES,
  FOLLOWUP_MODE, FOLLOWUP_PRIORITY, FOLLOWUP_STATUS,
} from "../data/schema";

export default function Tickets() {
  const { items: customers, save: saveCustomer } = useCustomers();
  const { items: products, save: saveProduct } = useProducts();
  const { items: tickets, save: saveTicket, remove: removeTicket } = useTickets();
  const { items: followups, save: saveFollowUp } = useFollowUps();
  const { permissions } = useAuth();
  const confirmDialog = useConfirm();
  const showToast = useToast();
  const [stageFilter, setStageFilter] = useState("");
  const [queryFilter, setQueryFilter] = useState("open"); // open | closed | all
  const [sortMode, setSortMode] = useState("stale"); // stale | recent | oldest | ticket
  const [searchQuery, setSearchQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [openTicket, setOpenTicket] = useState(null);
  const [remindGroup, setRemindGroup] = useState(null); // { customer, tickets }
  const [quickFollowUpFor, setQuickFollowUpFor] = useState(null); // ticket
  const [editingTicket, setEditingTicket] = useState(null); // ticket
  const [closingTicket, setClosingTicket] = useState(null); // ticket

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
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      const matchesStage = !stageFilter || t.stage === stageFilter;
      const matchesQuery =
        queryFilter === "all" ||
        (queryFilter === "open" && OPEN_STAGES.includes(t.stage)) ||
        (queryFilter === "closed" && !OPEN_STAGES.includes(t.stage));
      const matchesCustomer = !customerFilter || t.customerId === customerFilter;
      const matchesProduct = !productFilter || t.productId === productFilter;
      const matchesSearch =
        !q ||
        [
          t.ticketNumber,
          t.shade,
          customers.find((c) => c.id === t.customerId)?.name,
          customers.find((c) => c.id === t.customerId)?.buyerName,
          products.find((p) => p.id === t.productId)?.qualityName,
        ].filter(Boolean).join(" ").toLowerCase().includes(q);
      return matchesStage && matchesQuery && matchesCustomer && matchesProduct && matchesSearch;
    });
  }, [tickets, stageFilter, queryFilter, customerFilter, productFilter, searchQuery, customers, products]);

  // One row per CUSTOMER, with all their sample tickets nested inside —
  // a customer often gets several qualities sampled at once, so a flat
  // per-ticket list made it look like separate customers.
  const groupedByCustomer = useMemo(() => {
    const map = new Map();
    filtered.forEach((t) => {
      if (!map.has(t.customerId)) map.set(t.customerId, []);
      map.get(t.customerId).push(t);
    });
    const groups = Array.from(map.entries())
      .map(([customerId, ticketsForCustomer]) => ({
        customer: customers.find((c) => c.id === customerId),
        tickets: ticketsForCustomer.sort((a, b) => new Date(b.date) - new Date(a.date)),
      }))
      .filter((g) => g.customer);

    const oldestStaleness = (g) => Math.min(...g.tickets.map((t) => daysBetween(lastTouchedDate(t.id, t.date))));

    if (sortMode === "stale") {
      groups.sort((a, b) => oldestStaleness(b) - oldestStaleness(a));
    } else if (sortMode === "recent") {
      groups.sort((a, b) => new Date(b.tickets[0].date) - new Date(a.tickets[0].date));
    } else if (sortMode === "oldest") {
      groups.sort((a, b) => new Date(a.tickets[a.tickets.length - 1].date) - new Date(b.tickets[b.tickets.length - 1].date));
    } else if (sortMode === "ticket") {
      groups.sort((a, b) => (a.tickets[0].ticketNumber || "").localeCompare(b.tickets[0].ticketNumber || ""));
      groups.forEach((g) => g.tickets.sort((a, b) => (a.ticketNumber || "").localeCompare(b.ticketNumber || "")));
    }
    return groups;
  }, [filtered, customers, sortMode]);

  const summary = useMemo(() => ({
    open: tickets.filter((t) => OPEN_STAGES.includes(t.stage)).length,
    closed: tickets.filter((t) => !OPEN_STAGES.includes(t.stage)).length,
    total: tickets.length,
  }), [tickets]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Sample Management</h1>
          <p className="text-muted text-sm mt-1">{tickets.length} tickets across {new Set(tickets.map(t => t.customerId)).size} customers</p>
        </div>
        <button
          onClick={() => setCreatingTicket(true)}
          className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink2 transition"
        >
          + New Sample Ticket
        </button>
      </div>

      <div className="grid grid-cols-3 bg-panel border border-line rounded-2xl overflow-hidden">
        <div className="text-center py-3 border-r border-line">
          <div className="font-display font-bold text-xl text-thread">{summary.open}</div>
          <div className="text-[11px] text-muted uppercase tracking-wide">Open</div>
        </div>
        <div className="text-center py-3 border-r border-line">
          <div className="font-display font-bold text-xl text-loom">{summary.closed}</div>
          <div className="text-[11px] text-muted uppercase tracking-wide">Closed</div>
        </div>
        <div className="text-center py-3">
          <div className="font-display font-bold text-xl text-ink">{summary.total}</div>
          <div className="text-[11px] text-muted uppercase tracking-wide">Total</div>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search ticket number, customer, buyer, product, shade…"
          className="w-full border border-line rounded-lg pl-9 pr-3 py-2.5 text-sm bg-white outline-none focus:border-ink2"
        />
      </div>

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
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
          className="border border-line rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-ink2 w-fit"
        >
          <option value="stale">Sort: Needs attention first</option>
          <option value="recent">Sort: Date (newest first)</option>
          <option value="oldest">Sort: Date (oldest first)</option>
          <option value="ticket">Sort: Ticket number</option>
        </select>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="border border-line rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-ink2 w-fit"
        >
          <option value="">All stages</option>
          {TICKET_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="border border-line rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-ink2 w-fit max-w-[160px]"
        >
          <option value="">All customers</option>
          {customers
            .filter((c) => tickets.some((t) => t.customerId === c.id))
            .slice()
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="border border-line rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-ink2 w-fit max-w-[160px]"
        >
          <option value="">All products</option>
          {products
            .filter((p) => tickets.some((t) => t.productId === p.id))
            .slice()
            .sort((a, b) => (a.qualityName || "").localeCompare(b.qualityName || ""))
            .map((p) => <option key={p.id} value={p.id}>{p.qualityName}</option>)}
        </select>

        {(searchQuery || customerFilter || productFilter || stageFilter) && (
          <button
            onClick={() => { setSearchQuery(""); setCustomerFilter(""); setProductFilter(""); setStageFilter(""); }}
            className="text-xs font-semibold text-rust hover:underline"
          >
            Clear filters
          </button>
        )}
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

              <div className="flex flex-col gap-2">
                {customerTickets.map((t) => {
                  const staleDays = daysBetween(lastTouchedDate(t.id, t.date));
                  const isOpenQuery = OPEN_STAGES.includes(t.stage);
                  const isStale = isOpenQuery && staleDays >= 7;
                  const followUpCount = followups.filter((f) => f.ticketId === t.id).length;
                  return (
                    <div
                      key={t.id}
                      className={`border rounded-xl p-3 ${isStale ? "border-rust/30 bg-rust/5" : "border-line"}`}
                    >
                      <button onClick={() => setOpenTicket(t)} className="w-full text-left flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-muted">{t.ticketNumber}</span>
                            <StageBadge stage={t.stage} />
                            {isStale && (
                              <span className="text-[10px] font-semibold text-rust bg-rust/10 border border-rust/30 rounded-full px-1.5 py-0.5">
                                {isOpenQuery ? `${staleDays}d open, no contact` : ""}
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-medium mt-0.5">{productName(t.productId)} · {t.shade}</div>
                          <div className="text-xs text-muted">{formatDate(t.date)} · Follow-ups: {followUpCount}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-muted uppercase tracking-wide">Probability</div>
                          <div className="font-display font-bold text-sm text-thread">{ticketProbability(t, followups)}%</div>
                        </div>
                      </button>

                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        <ActionBtn tone="violet" onClick={() => setQuickFollowUpFor(t)}>
                          <RefreshCw size={12} /> Follow-up
                        </ActionBtn>
                        {customer.whatsapp && (
                          <ActionBtn tone="loom" as="a" href={buildWhatsAppLink(customer.whatsapp, getTemplateMessage("sampleReminder", customer, t))} target="_blank" rel="noreferrer">
                            <MessageCircle size={12} /> WA
                          </ActionBtn>
                        )}
                        {customer.phone && (
                          <ActionBtn tone="ink2" as="a" href={`tel:${customer.phone.replace(/\D/g, "")}`}>
                            <Phone size={12} /> Call
                          </ActionBtn>
                        )}
                        {isOpenQuery ? (
                          <ActionBtn tone="loom" onClick={() => setClosingTicket(t)}>
                            <CheckCircle2 size={12} /> Close
                          </ActionBtn>
                        ) : (
                          <ActionBtn tone="muted" disabled>
                            <CheckCircle2 size={12} /> Closed
                          </ActionBtn>
                        )}
                        <ActionBtn tone="ink2" onClick={() => setEditingTicket(t)}>
                          <Pencil size={12} /> Edit
                        </ActionBtn>
                        {permissions?.canDelete && (
                          <ActionBtn tone="rust" onClick={async () => {
                            const ok = await confirmDialog(`Delete ticket ${t.ticketNumber}? This can't be undone.`);
                            if (ok) { await removeTicket(t.id); showToast(`${t.ticketNumber} deleted.`, "success"); }
                          }}>
                            <Trash2 size={12} /> Delete
                          </ActionBtn>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {groupedByCustomer.length === 0 && (
          <div className="text-center py-12 text-muted text-sm">No tickets in this view.</div>
        )}
      </div>

      <Modal open={!!quickFollowUpFor} onClose={() => setQuickFollowUpFor(null)} title={`Follow-up — ${quickFollowUpFor?.ticketNumber || ""}`}>
        {quickFollowUpFor && (
          <FollowUpForm
            ticketId={quickFollowUpFor.id}
            onSave={async (f) => { await saveFollowUp(f); setQuickFollowUpFor(null); }}
            onCancel={() => setQuickFollowUpFor(null)}
          />
        )}
      </Modal>

      <Modal open={!!editingTicket} onClose={() => setEditingTicket(null)} title={`Edit ${editingTicket?.ticketNumber || ""}`} wide>
        {editingTicket && (
          <TicketEditForm
            ticket={editingTicket}
            customers={customers}
            products={products}
            onCreateCustomer={async (c) => saveCustomer(c)}
            onCreateProduct={async (p) => saveProduct(p)}
            onSave={async (form) => { await saveTicket(form); setEditingTicket(null); }}
            onCancel={() => setEditingTicket(null)}
          />
        )}
      </Modal>

      <Modal open={!!closingTicket} onClose={() => setClosingTicket(null)} title={`Close Query — ${closingTicket?.ticketNumber || ""}`}>
        {closingTicket && (
          <QuickClosePanel
            ticket={closingTicket}
            onClose={async (patch) => {
              try {
                await saveTicket({ ...closingTicket, ...patch });
                setClosingTicket(null);
                setQueryFilter("closed"); // otherwise the ticket just vanishes from "Open" with no visible confirmation
                showToast(`${closingTicket.ticketNumber} closed — moved to Closed tab.`, "success");
              } catch (err) {
                showToast(`Couldn't close this query: ${err.message || err}`, "error");
              }
            }}
            onCancel={() => setClosingTicket(null)}
          />
        )}
      </Modal>

      <Modal open={creatingTicket} onClose={() => setCreatingTicket(false)} title="New Sample Ticket" wide>
        {creatingTicket && (
          <NewTicketForm
            customers={customers}
            products={products}
            existingTickets={tickets}
            onCreateCustomer={saveCustomer}
            onCreateProduct={saveProduct}
            onSubmit={async (ticketsToCreate) => {
              for (const t of ticketsToCreate) await saveTicket(t);
              setCreatingTicket(false);
            }}
            onCancel={() => setCreatingTicket(false)}
          />
        )}
      </Modal>

      <Modal open={!!openTicket} onClose={() => setOpenTicket(null)} title={openTicket?.ticketNumber} wide>
        {openTicket && (
          <TicketDetail
            ticket={tickets.find((t) => t.id === openTicket.id) || openTicket}
            customer={customers.find((c) => c.id === openTicket.customerId)}
            product={products.find((p) => p.id === openTicket.productId)}
            customers={customers}
            products={products}
            onCreateCustomer={saveCustomer}
            onCreateProduct={saveProduct}
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

const ACTION_TONES = {
  violet: "bg-violet-500/10 text-violet-700 border-violet-500/30 hover:bg-violet-500/20",
  loom: "bg-loom/10 text-loom border-loom/30 hover:bg-loom/20",
  ink2: "bg-ink2/10 text-ink2 border-ink2/30 hover:bg-ink2/20",
  rust: "bg-rust/10 text-rust border-rust/30 hover:bg-rust/20",
  muted: "bg-muted/10 text-muted border-muted/30",
};

function ActionBtn({ tone = "ink2", as = "button", children, disabled, ...props }) {
  const Tag = as;
  return (
    <Tag
      {...props}
      type={as === "button" ? (props.type || "button") : undefined}
      disabled={as === "button" ? disabled : undefined}
      className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border whitespace-nowrap ${ACTION_TONES[tone]} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      {children}
    </Tag>
  );
}

function QuickClosePanel({ ticket, onClose, onCancel }) {
  const [result, setResult] = useState(null); // "won" | "lost"
  const [orderValue, setOrderValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!result) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">Did this sample convert to an order?</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setResult("won")} className="flex-1 py-3 rounded-lg text-sm font-semibold bg-loom text-white hover:opacity-90">
            ✔ Order Won
          </button>
          <button type="button" onClick={() => setResult("lost")} className="flex-1 py-3 rounded-lg text-sm font-semibold bg-rust text-white hover:opacity-90">
            ✕ Didn't Convert
          </button>
        </div>
        <button type="button" onClick={onCancel} className="text-xs text-muted hover:underline self-center mt-1">Cancel</button>
      </div>
    );
  }

  const isWon = result === "won";

  const handleConfirm = async () => {
    if (saving) return; // guard against double-tap firing this twice
    setSaving(true);
    try {
      await onClose({
        stage: isWon ? "Bulk Order" : "Lost",
        closureNote: note,
        orderValue: isWon ? orderValue : "",
        closedAt: new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {isWon && (
        <Field label="Order Value (₹, optional)">
          <TextInput type="number" value={orderValue} onChange={(e) => setOrderValue(e.target.value)} placeholder="e.g. 45000" />
        </Field>
      )}
      <Field label={isWon ? "Notes (quantity, terms, etc.)" : "Reason (shade/price/quality/timing…)"}>
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setResult(null)} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper disabled:opacity-50">Back</button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${isWon ? "bg-loom" : "bg-rust"} hover:opacity-90 disabled:opacity-60`}
        >
          {saving ? "Saving…" : "Confirm & Close"}
        </button>
      </div>
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

// ---------- New Sample Ticket — one customer, one-or-more qualities ----------
function blankRow() {
  return { key: newId(), productId: "", shade: "", quantity: "", sampleType: "Cutting" };
}

function NewTicketForm({ customers, products, existingTickets, onCreateCustomer, onCreateProduct, onSubmit, onCancel }) {
  const [customerId, setCustomerId] = useState("");
  const [rows, setRows] = useState([blankRow()]);
  const [shared, setShared] = useState({
    date: new Date().toISOString().slice(0, 10),
    dispatchMode: "Courier", courierName: "", trackingNumber: "", courierCharges: "", podReceived: false,
    dispatchDate: "", expectedDelivery: "", stage: "Sample Sent", remarks: "",
  });
  const [quickAdd, setQuickAdd] = useState(null); // null | "customer" | { row: key }

  const setSharedField = (k) => (e) => setShared({ ...shared, [k]: e.target.value });
  const setSharedBool = (k) => (e) => setShared({ ...shared, [k]: e.target.checked });

  const updateRow = (key, patch) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows([...rows, blankRow()]);
  const removeRow = (key) => setRows(rows.length > 1 ? rows.filter((r) => r.key !== key) : rows);

  const handleCreateCustomer = async (form) => {
    const saved = await onCreateCustomer(form);
    setCustomerId(saved.id);
    setQuickAdd(null);
  };

  const handleCreateProduct = async (form) => {
    const saved = await onCreateProduct(form);
    if (quickAdd?.row) updateRow(quickAdd.row, { productId: saved.id });
    setQuickAdd(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validRows = rows.filter((r) => r.productId);
    if (!customerId || validRows.length === 0) return;
    const ticketNumbers = nextTicketNumbers(existingTickets, validRows.length);
    const tickets = validRows.map((r, i) => ({
      ticketNumber: ticketNumbers[i],
      date: shared.date,
      customerId,
      productId: r.productId,
      shade: r.shade,
      quantity: r.quantity,
      unit: "meters",
      sampleType: r.sampleType,
      dispatchMode: shared.dispatchMode,
      courierName: shared.courierName,
      trackingNumber: shared.trackingNumber,
      courierCharges: shared.courierCharges,
      podReceived: shared.podReceived,
      dispatchDate: shared.dispatchDate,
      expectedDelivery: shared.expectedDelivery,
      received: false,
      garmentDeveloped: false,
      stage: shared.stage,
      remarks: shared.remarks,
    }));
    onSubmit(tickets);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Customer *">
        <EntitySearchField
          items={customers}
          value={customerId}
          onChange={setCustomerId}
          displayFn={(c) => c.name}
          subFn={(c) => [c.city, c.buyerName].filter(Boolean).join(" · ")}
          searchFields={["name", "city", "buyerName", "phone"]}
          placeholder="Search or select customer…"
          onAddNew={() => setQuickAdd("customer")}
          addNewLabel="Add New Customer"
        />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-ink/80">Qualities being sampled *</span>
          <button type="button" onClick={addRow} className="text-xs font-semibold text-ink2 hover:underline">
            + Add another quality
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.key} className="border border-line rounded-lg p-3 grid sm:grid-cols-2 gap-2 relative">
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  className="absolute top-2 right-2 text-xs text-muted hover:text-rust"
                  aria-label="Remove this quality"
                >
                  ✕
                </button>
              )}
              <div className="sm:col-span-2">
                <EntitySearchField
                  items={products}
                  value={row.productId}
                  onChange={(id) => updateRow(row.key, { productId: id })}
                  displayFn={(p) => p.qualityName}
                  subFn={(p) => [p.category, p.millName].filter(Boolean).join(" · ")}
                  searchFields={["qualityName", "category", "millName", "colour"]}
                  placeholder="Search or select product quality…"
                  onAddNew={() => setQuickAdd({ row: row.key })}
                  addNewLabel="Add New Product"
                />
              </div>
              <TextInput placeholder="Shade" value={row.shade} onChange={(e) => updateRow(row.key, { shade: e.target.value })} />
              <TextInput placeholder="Quantity" value={row.quantity} onChange={(e) => updateRow(row.key, { quantity: e.target.value })} />
              <Select
                options={SAMPLE_TYPE}
                value={row.sampleType}
                onChange={(e) => updateRow(row.key, { sampleType: e.target.value })}
                className="sm:col-span-2"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Date"><TextInput type="date" value={shared.date} onChange={setSharedField("date")} /></Field>
        <Field label="Dispatch Mode">
          <Select options={DISPATCH_MODE} value={shared.dispatchMode} onChange={setSharedField("dispatchMode")} />
        </Field>
        {shared.dispatchMode === "Courier" && (
          <>
            <Field label="Courier Name"><TextInput value={shared.courierName} onChange={setSharedField("courierName")} /></Field>
            <Field label="Tracking Number"><TextInput value={shared.trackingNumber} onChange={setSharedField("trackingNumber")} /></Field>
            <Field label="Courier Charges (₹)"><TextInput value={shared.courierCharges} onChange={setSharedField("courierCharges")} /></Field>
            <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={shared.podReceived} onChange={setSharedBool("podReceived")} /> POD received</label>
          </>
        )}
        <Field label="Dispatch Date"><TextInput type="date" value={shared.dispatchDate} onChange={setSharedField("dispatchDate")} /></Field>
        <Field label="Expected Delivery"><TextInput type="date" value={shared.expectedDelivery} onChange={setSharedField("expectedDelivery")} /></Field>
        <Field label="Stage"><Select options={TICKET_STAGES} value={shared.stage} onChange={setSharedField("stage")} /></Field>
        <Field label="Remarks" className="sm:col-span-2"><TextArea value={shared.remarks} onChange={setSharedField("remarks")} /></Field>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper">Cancel</button>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink2">
          Create Ticket{rows.filter((r) => r.productId).length > 1 ? "s" : ""}
        </button>
      </div>

      <Modal open={quickAdd === "customer"} onClose={() => setQuickAdd(null)} title="Add New Customer" wide>
        <CustomerForm initial={BLANK_CUSTOMER} onSave={handleCreateCustomer} onCancel={() => setQuickAdd(null)} />
      </Modal>
      <Modal open={!!quickAdd?.row} onClose={() => setQuickAdd(null)} title="Add New Product" wide>
        <ProductForm initial={BLANK_PRODUCT} onSave={handleCreateProduct} onCancel={() => setQuickAdd(null)} />
      </Modal>
    </form>
  );
}

// ---------- Ticket detail: view, edit, close, follow up, attach ----------
function TicketDetail({ ticket, customer, product, customers, products, onCreateCustomer, onCreateProduct, onUpdate }) {
  const { items: allFollowUps, save: saveFollowUp } = useFollowUps();
  const { items: allAttachments, save: saveAttachment, remove: removeAttachment } = useAttachments();
  const confirmDialog = useConfirm();
  const [addingFollowUp, setAddingFollowUp] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [closureNote, setClosureNote] = useState(ticket.closureNote || "");
  const [orderValue, setOrderValue] = useState(ticket.orderValue || "");
  const [editing, setEditing] = useState(false);

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

  const handleStageChange = (stage) => onUpdate({ stage });

  const closeQuery = () => {
    onUpdate({
      closureNote,
      orderValue: isWon ? orderValue : "",
      closedAt: new Date().toISOString(),
    });
  };

  if (editing) {
    return (
      <TicketEditForm
        ticket={ticket}
        customers={customers}
        products={products}
        onCreateCustomer={onCreateCustomer}
        onCreateProduct={onCreateProduct}
        onSave={async (patch) => { await onUpdate(patch); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-sm font-semibold">{customer?.name}</span>
          <span className="text-xs text-muted"> · {product?.qualityName} · {ticket.shade}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-ink2 hover:underline">
            Edit
          </button>
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
                  onClick={async () => { const ok = await confirmDialog("Remove this photo?"); if (ok) removeAttachment(a.id); }}
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

function TicketEditForm({ ticket, customers, products, onCreateCustomer, onCreateProduct, onSave, onCancel }) {
  const [form, setForm] = useState({ ...ticket });
  const [quickAdd, setQuickAdd] = useState(null); // null | "customer" | "product"
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setBool = (k) => (e) => setForm({ ...form, [k]: e.target.checked });

  const handleCreateCustomer = async (data) => {
    const saved = await onCreateCustomer(data);
    setForm({ ...form, customerId: saved.id });
    setQuickAdd(null);
  };
  const handleCreateProduct = async (data) => {
    const saved = await onCreateProduct(data);
    setForm({ ...form, productId: saved.id });
    setQuickAdd(null);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="flex flex-col gap-3">
      <Field label="Customer *">
        <EntitySearchField
          items={customers}
          value={form.customerId}
          onChange={(id) => setForm({ ...form, customerId: id })}
          displayFn={(c) => c.name}
          subFn={(c) => [c.city, c.buyerName].filter(Boolean).join(" · ")}
          searchFields={["name", "city", "buyerName", "phone"]}
          placeholder="Search or select customer…"
          onAddNew={() => setQuickAdd("customer")}
          addNewLabel="Add New Customer"
        />
      </Field>
      <Field label="Product *">
        <EntitySearchField
          items={products}
          value={form.productId}
          onChange={(id) => setForm({ ...form, productId: id })}
          displayFn={(p) => p.qualityName}
          subFn={(p) => [p.category, p.millName].filter(Boolean).join(" · ")}
          searchFields={["qualityName", "category", "millName", "colour"]}
          placeholder="Search or select product quality…"
          onAddNew={() => setQuickAdd("product")}
          addNewLabel="Add New Product"
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Shade"><TextInput value={form.shade} onChange={set("shade")} /></Field>
        <Field label="Quantity"><TextInput value={form.quantity} onChange={set("quantity")} /></Field>
        <Field label="Sample Type"><Select options={SAMPLE_TYPE} value={form.sampleType} onChange={set("sampleType")} /></Field>
        <Field label="Dispatch Mode"><Select options={DISPATCH_MODE} value={form.dispatchMode} onChange={set("dispatchMode")} /></Field>
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
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.received} onChange={setBool("received")} /> Received by customer</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.garmentDeveloped} onChange={setBool("garmentDeveloped")} /> Garment developed</label>
      </div>
      <Field label="Remarks"><TextArea value={form.remarks} onChange={set("remarks")} /></Field>

      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper">Cancel</button>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink2">Save Changes</button>
      </div>

      <Modal open={quickAdd === "customer"} onClose={() => setQuickAdd(null)} title="Add New Customer" wide>
        <CustomerForm initial={BLANK_CUSTOMER} onSave={handleCreateCustomer} onCancel={() => setQuickAdd(null)} />
      </Modal>
      <Modal open={quickAdd === "product"} onClose={() => setQuickAdd(null)} title="Add New Product" wide>
        <ProductForm initial={BLANK_PRODUCT} onSave={handleCreateProduct} onCancel={() => setQuickAdd(null)} />
      </Modal>
    </form>
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
