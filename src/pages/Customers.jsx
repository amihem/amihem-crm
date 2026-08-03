import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCustomers, useTickets, useFollowUps } from "../context/domains.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { CustomerStatusBadge, TemperatureBadge } from "../components/StatusBadge.jsx";
import Modal from "../components/Modal.jsx";
import MasterTabs from "../components/MasterTabs.jsx";
import SearchDropdown from "../components/SearchDropdown.jsx";
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
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState(null); // null=closed, {}=new, {...}=edit
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const filtered = useMemo(() => {
    return customers
      .filter((c) => {
        const matchesQuery = !query || [c.name, c.company, c.city, c.buyerName, c.phone]
          .join(" ").toLowerCase().includes(query.toLowerCase());
        const matchesStatus = !statusFilter || c.status === statusFilter;
        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [customers, query, statusFilter]);

  const suggestions = useMemo(() => {
    if (!query) return [];
    return filtered.map((c) => ({ id: c.id, label: c.name, sublabel: `${c.city || ""}${c.buyerName ? ` · ${c.buyerName}` : ""}` }));
  }, [filtered, query]);

  const handleSave = async (form) => {
    await save(form);
    setEditing(null);
  };

  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelected(new Set());
  };

  const toggleSelected = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(filtered.map((c) => c.id)));
  const clearSelection = () => setSelected(new Set());

  const bulkDelete = async () => {
    if (!confirm(`Remove ${selected.size} selected customer(s)? This can't be undone.`)) return;
    for (const id of selected) await remove(id);
    setSelected(new Set());
  };

  const bulkSetStatus = async (status) => {
    for (const id of selected) {
      const c = customers.find((cc) => cc.id === id);
      if (c) await save({ ...c, status });
    }
    setSelected(new Set());
  };

  return (
    <div className="flex flex-col gap-5">
      <MasterTabs active="customers" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Customers</h1>
          <p className="text-muted text-sm mt-1">{customers.length} total</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleSelectMode}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-line hover:bg-paper transition"
          >
            {selectMode ? "Cancel" : "Select"}
          </button>
          <button
            onClick={() => setEditing({ ...BLANK })}
            className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink2 transition"
          >
            + Add Customer
          </button>
        </div>
      </div>

      {selectMode && (
        <div className="bg-ink2/5 border border-ink2/20 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap text-sm">
          <span className="font-semibold">{selected.size} selected</span>
          <button onClick={selectAll} className="text-ink2 font-semibold hover:underline">Select all ({filtered.length})</button>
          {selected.size > 0 && (
            <>
              <button onClick={clearSelection} className="text-muted font-semibold hover:underline">Clear</button>
              <div className="flex items-center gap-2 ml-auto">
                <select
                  onChange={(e) => { if (e.target.value) bulkSetStatus(e.target.value); e.target.value = ""; }}
                  defaultValue=""
                  className="border border-line rounded-lg px-2 py-1.5 text-xs bg-white"
                >
                  <option value="" disabled>Set status…</option>
                  {CUSTOMER_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {permissions?.canDelete && (
                  <button onClick={bulkDelete} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-rust/10 text-rust border border-rust/30 hover:bg-rust/20">
                    Delete Selected
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <SearchDropdown
          query={query}
          onQueryChange={setQuery}
          suggestions={suggestions}
          onSelect={(s) => navigate(`/customers/${s.id}`)}
          placeholder="Search name, city, buyer, phone…"
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
          <div key={c.id} className={`bg-panel border rounded-2xl p-4 flex flex-col gap-2 shadow-sm relative ${selected.has(c.id) ? "border-ink2" : "border-line"}`}>
            {selectMode && (
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggleSelected(c.id)}
                className="absolute top-3 right-3 w-4 h-4 z-10"
              />
            )}
            <Link to={selectMode ? "#" : `/customers/${c.id}`} onClick={(e) => { if (selectMode) { e.preventDefault(); toggleSelected(c.id); } }} className="flex items-start justify-between gap-2">
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
              {c.phone && (
                <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="text-xs font-semibold text-ink2 hover:underline">
                  Call
                </a>
              )}
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
