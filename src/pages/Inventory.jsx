import { useState } from "react";
import { useInventory, useProducts } from "../context/domains.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import { Field, TextInput, Select } from "../components/FormField.jsx";
import { LOW_STOCK_THRESHOLD } from "../data/schema";

const ITEM_TYPES = ["Sample Book", "Hanger", "Shade Card", "Cut Piece"];

const BLANK = { productId: "", itemType: "Hanger", shade: "", quantity: "1", location: "", remarks: "" };

export default function Inventory() {
  const { items: inventory, save, remove } = useInventory();
  const { items: products } = useProducts();
  const { permissions } = useAuth();
  const [editing, setEditing] = useState(null);

  const productName = (id) => products.find((p) => p.id === id)?.qualityName || "—";
  const lowStockCount = inventory.filter((i) => Number(i.quantity) <= LOW_STOCK_THRESHOLD).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Fabric Book & Hanger Inventory</h1>
          <p className="text-muted text-sm mt-1">Track what's on hand so you don't dispatch duplicates.</p>
        </div>
        <button
          onClick={() => setEditing({ ...BLANK, productId: products[0]?.id || "" })}
          disabled={!products.length}
          className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink2 transition disabled:opacity-40"
        >
          + Add Item
        </button>
      </div>

      {lowStockCount > 0 && (
        <p className="text-xs text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">
          {lowStockCount} item{lowStockCount > 1 ? "s" : ""} at or below {LOW_STOCK_THRESHOLD} in stock — restock soon.
        </p>
      )}

      <div className="overflow-x-auto bg-panel border border-line rounded-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wide border-b border-line">
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Shade</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((i) => {
              const low = Number(i.quantity) <= LOW_STOCK_THRESHOLD;
              return (
                <tr key={i.id} className={`border-b border-line last:border-0 hover:bg-paper ${low ? "bg-rust/5" : ""}`}>
                  <td className="px-4 py-3 font-medium">{productName(i.productId)}</td>
                  <td className="px-4 py-3 text-muted">{i.itemType}</td>
                  <td className="px-4 py-3 text-muted">{i.shade}</td>
                  <td className="px-4 py-3">
                    <span className={low ? "text-rust font-semibold" : "text-muted"}>{i.quantity}</span>
                    {low && <span className="ml-1.5 text-[10px] font-semibold text-rust bg-rust/10 border border-rust/30 rounded-full px-1.5 py-0.5">LOW</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{i.location}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(i)} className="text-xs font-semibold text-ink2 hover:underline mr-3">Edit</button>
                    {permissions?.canDelete && (
                      <button onClick={() => { if (confirm("Remove this item?")) remove(i.id); }} className="text-xs font-semibold text-rust hover:underline">
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {inventory.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">No inventory logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit Item" : "Add Item"}>
        {editing && (
          <InventoryForm
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

function InventoryForm({ initial, products, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="flex flex-col gap-3">
      <Field label="Product *">
        <Select required options={products.map((p) => p.qualityName)} value={products.find(p => p.id === form.productId)?.qualityName || ""}
          onChange={(e) => setForm({ ...form, productId: products.find(p => p.qualityName === e.target.value)?.id })} />
      </Field>
      <Field label="Item Type"><Select options={ITEM_TYPES} value={form.itemType} onChange={set("itemType")} /></Field>
      <Field label="Shade"><TextInput value={form.shade} onChange={set("shade")} /></Field>
      <Field label="Quantity"><TextInput type="number" value={form.quantity} onChange={set("quantity")} /></Field>
      <Field label="Location (rack/shelf)"><TextInput value={form.location} onChange={set("location")} /></Field>
      <div className="flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper">Cancel</button>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink2">Save</button>
      </div>
    </form>
  );
}
