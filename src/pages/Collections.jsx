import { useState } from "react";
import { useCollections, useProducts } from "../context/domains.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import { Field, TextInput, Select, TextArea } from "../components/FormField.jsx";
import { formatDate, isOverdue } from "../utils/helpers";
import { SEASONS } from "../data/schema";

const BLANK = { name: "", season: SEASONS[0], launchDate: "", productIds: [], remarks: "" };

export default function Collections() {
  const { items: collections, save, remove } = useCollections();
  const { items: products } = useProducts();
  const { permissions } = useAuth();
  const [editing, setEditing] = useState(null);

  const productName = (id) => products.find((p) => p.id === id)?.qualityName || "—";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Seasonal Collections</h1>
          <p className="text-muted text-sm mt-1">Plan launches and get reminded before they're due.</p>
        </div>
        <button onClick={() => setEditing({ ...BLANK })} className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink2 transition">
          + New Collection
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {collections.map((c) => (
          <div key={c.id} className="bg-panel border border-line rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display font-bold text-sm">{c.name}</div>
                <div className="text-xs text-muted">{c.season}</div>
              </div>
              {c.launchDate && (
                <span className={`text-xs font-semibold rounded-full px-2 py-1 border ${isOverdue(c.launchDate) ? "text-rust bg-rust/10 border-rust/30" : "text-thread bg-thread/10 border-thread/30"}`}>
                  Launch {formatDate(c.launchDate)}
                </span>
              )}
            </div>
            {c.productIds?.length > 0 && (
              <div className="text-xs text-muted">
                {c.productIds.map((id) => productName(id)).join(", ")}
              </div>
            )}
            {c.remarks && <p className="text-xs text-muted">{c.remarks}</p>}
            <div className="flex gap-2 mt-1">
              <button onClick={() => setEditing(c)} className="text-xs font-semibold text-ink2 hover:underline">Edit</button>
              {permissions?.canDelete && (
                <button onClick={() => { if (confirm(`Remove ${c.name}?`)) remove(c.id); }} className="text-xs font-semibold text-rust hover:underline ml-auto">
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        {collections.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted text-sm">No collections planned yet.</div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit Collection" : "New Collection"} wide>
        {editing && (
          <CollectionForm
            initial={editing}
            products={products}
            onSave={async (form) => { await save(form); setEditing(null); }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function CollectionForm({ initial, products, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const toggleProduct = (id) => {
    const selected = new Set(form.productIds || []);
    selected.has(id) ? selected.delete(id) : selected.add(id);
    setForm({ ...form, productIds: Array.from(selected) });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="flex flex-col gap-3">
      <Field label="Collection Name *"><TextInput required value={form.name} onChange={set("name")} /></Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Season"><Select options={SEASONS} value={form.season} onChange={set("season")} /></Field>
        <Field label="Launch Date"><TextInput type="date" value={form.launchDate} onChange={set("launchDate")} /></Field>
      </div>
      <Field label="Products in this collection">
        <div className="border border-line rounded-lg p-2 max-h-40 overflow-y-auto flex flex-col gap-1">
          {products.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm px-1 py-1">
              <input type="checkbox" checked={(form.productIds || []).includes(p.id)} onChange={() => toggleProduct(p.id)} />
              {p.qualityName}
            </label>
          ))}
          {products.length === 0 && <p className="text-xs text-muted px-1">No products in Product Master yet.</p>}
        </div>
      </Field>
      <Field label="Remarks"><TextArea value={form.remarks} onChange={set("remarks")} /></Field>
      <div className="flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper">Cancel</button>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink2">Save Collection</button>
      </div>
    </form>
  );
}
