import { useState } from "react";
import { useProducts } from "../context/domains.jsx";
import Modal from "../components/Modal.jsx";
import { Field, TextInput, Select, TextArea } from "../components/FormField.jsx";
import { PRODUCT_CATEGORY } from "../data/schema";

const BLANK = {
  category: "Cotton", subCategory: "", qualityName: "", construction: "",
  composition: "", gsm: "", width: "", millName: "", colour: "", moq: "", price: "", remarks: "",
};

export default function Products() {
  const { items: products, save, remove } = useProducts();
  const [editing, setEditing] = useState(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Product Master</h1>
          <p className="text-muted text-sm mt-1">{products.length} qualities</p>
        </div>
        <button
          onClick={() => setEditing({ ...BLANK })}
          className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-ink2 transition"
        >
          + Add Product
        </button>
      </div>

      <div className="overflow-x-auto bg-panel border border-line rounded-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wide border-b border-line">
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">GSM / Width</th>
              <th className="px-4 py-3">Mill</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-paper">
                <td className="px-4 py-3 font-medium">{p.qualityName}</td>
                <td className="px-4 py-3 text-muted">{p.category}</td>
                <td className="px-4 py-3 text-muted">{p.gsm} gsm · {p.width}"</td>
                <td className="px-4 py-3 text-muted">{p.millName}</td>
                <td className="px-4 py-3 text-muted">₹{p.price}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(p)} className="text-xs font-semibold text-ink2 hover:underline mr-3">Edit</button>
                  <button
                    onClick={() => { if (confirm(`Remove ${p.qualityName}?`)) remove(p.id); }}
                    className="text-xs font-semibold text-rust hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">No products yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit Product" : "Add Product"} wide>
        {editing && (
          <ProductForm
            initial={editing}
            onSave={async (form) => { await save(form); setEditing(null); }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function ProductForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="grid sm:grid-cols-2 gap-3">
      <Field label="Quality Name *"><TextInput required value={form.qualityName} onChange={set("qualityName")} /></Field>
      <Field label="Category">
        <Select options={PRODUCT_CATEGORY} value={form.category} onChange={set("category")} />
      </Field>
      <Field label="Construction"><TextInput value={form.construction} onChange={set("construction")} /></Field>
      <Field label="Composition"><TextInput value={form.composition} onChange={set("composition")} /></Field>
      <Field label="GSM"><TextInput value={form.gsm} onChange={set("gsm")} /></Field>
      <Field label="Width (inch)"><TextInput value={form.width} onChange={set("width")} /></Field>
      <Field label="Mill Name"><TextInput value={form.millName} onChange={set("millName")} /></Field>
      <Field label="Colour"><TextInput value={form.colour} onChange={set("colour")} /></Field>
      <Field label="MOQ"><TextInput value={form.moq} onChange={set("moq")} /></Field>
      <Field label="Price (₹)"><TextInput value={form.price} onChange={set("price")} /></Field>
      <Field label="Remarks" className="sm:col-span-2"><TextArea value={form.remarks} onChange={set("remarks")} /></Field>

      <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper">Cancel</button>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink2">Save Product</button>
      </div>
    </form>
  );
}
