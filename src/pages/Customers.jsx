import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCustomers, useTickets, useFollowUps } from "../context/domains.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { CustomerStatusBadge, TemperatureBadge } from "../components/StatusBadge.jsx";
import Modal from "../components/Modal.jsx";
import { Field, TextInput, Select, TextArea } from "../components/FormField.jsx";
import { CUSTOMER_STATUS, CUSTOMER_CATEGORY } from "../data/schema";
import { scoreCustomer, scoreTemperature } from "../utils/scoring";

const BLANK = {
  name: "", company: "", city: "", state: "", country: "India",
  buyerName: "", phone: "", whatsapp: "", email: "", category: "Manufacturer",
  status: "Potential", preferredFabric: "", creditDays: "", remarks: "",
};

export default function Customers() {
  const { items: customers, save, remove } = useCustomers();
  const { items: tickets } = useTickets();
  const { items: followups } = useFollowUps();
  const { permissions } = useAuth();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState(null); // null=closed, {}=new, {...}=edit

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const matchesQuery = !query || [c.name, c.company, c.city, c.buyerName, c.phone]
        .join(" ").toLowerCase().includes(query.toLowerCase());
      const matchesStatus = !statusFilter || c.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [customers, query, statusFilter]);

  const handleSave = async (form) => {
    await save(form);
    setEditing(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Customers</h1>
          <p className="text-muted text-sm mt-1">{customers.length} total</p>
        </div>
        <button
          onClick={() => setEditing({ ...BLANK })}
          className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink2 transition"
        >
          + Add Customer
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          placeholder="Search name, city, buyer, phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border border-line rounded-lg px-3 py-2 text-sm bg-white flex-1 min-w-[200px] outline-none focus:border-ink2"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-line rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-ink2"
        >
          <option value="">All statuses</option>
          {CUSTOMER_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((c) => {
          const temp = scoreTemperature(scoreCustomer(c, tickets, followups));
          return (
          <div key={c.id} className="bg-panel border border-line rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
            <Link to={`/customers/${c.id}`} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-display font-bold text-sm truncate">{c.name}</div>
                <div className="text-xs text-muted truncate">{c.city}{c.state ? `, ${c.state}` : ""}</div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <CustomerStatusBadge status={c.status} />
                <TemperatureBadge temp={temp} />
              </div>
            </Link>
            <div className="text-xs text-muted flex flex-col gap-0.5">
              {c.buyerName && <span>Buyer: {c.buyerName}</span>}
              {c.category && <span>{c.category}</span>}
              {c.preferredFabric && <span>Prefers: {c.preferredFabric}</span>}
            </div>
            <div className="flex gap-2 mt-1">
              {c.whatsapp && (
                <a
                  href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
                  target="_blank" rel="noreferrer"
                  className="text-xs font-semibold text-loom hover:underline"
                >
                  WhatsApp
                </a>
              )}
              <button onClick={() => setEditing(c)} className="text-xs font-semibold text-ink2 hover:underline">
                Edit
              </button>
              {permissions?.canDelete && (
                <button
                  onClick={() => { if (confirm(`Remove ${c.name}?`)) remove(c.id); }}
                  className="text-xs font-semibold text-rust hover:underline ml-auto"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted text-sm">No customers match your search.</div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit Customer" : "Add Customer"} wide>
        {editing && <CustomerForm initial={editing} onSave={handleSave} onCancel={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function CustomerForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(form); }}
      className="grid sm:grid-cols-2 gap-3"
    >
      <Field label="Customer Name *"><TextInput required value={form.name} onChange={set("name")} /></Field>
      <Field label="Company"><TextInput value={form.company} onChange={set("company")} /></Field>
      <Field label="City"><TextInput value={form.city} onChange={set("city")} /></Field>
      <Field label="State"><TextInput value={form.state} onChange={set("state")} /></Field>
      <Field label="Buyer Name"><TextInput value={form.buyerName} onChange={set("buyerName")} /></Field>
      <Field label="Category">
        <Select options={CUSTOMER_CATEGORY} value={form.category} onChange={set("category")} />
      </Field>
      <Field label="Phone"><TextInput value={form.phone} onChange={set("phone")} /></Field>
      <Field label="WhatsApp"><TextInput value={form.whatsapp} onChange={set("whatsapp")} /></Field>
      <Field label="Email"><TextInput type="email" value={form.email} onChange={set("email")} /></Field>
      <Field label="Preferred Fabric"><TextInput value={form.preferredFabric} onChange={set("preferredFabric")} /></Field>
      <Field label="Credit Days"><TextInput type="number" value={form.creditDays} onChange={set("creditDays")} /></Field>
      <Field label="Status">
        <Select options={CUSTOMER_STATUS} value={form.status} onChange={set("status")} />
      </Field>
      <Field label="Remarks" className="sm:col-span-2">
        <TextArea value={form.remarks} onChange={set("remarks")} />
      </Field>

      <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink2">
          Save Customer
        </button>
      </div>
    </form>
  );
}
