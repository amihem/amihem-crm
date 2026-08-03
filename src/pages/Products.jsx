import { useMemo, useState } from "react";
import { useProducts } from "../context/domains.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import MasterTabs from "../components/MasterTabs.jsx";
import SearchDropdown from "../components/SearchDropdown.jsx";
import { Field, TextInput, Select, TextArea } from "../components/FormField.jsx";
import { PRODUCT_CATEGORY } from "../data/schema";

const BLANK = {
  category: "Cotton", subCategory: "", qualityName: "", construction: "",
  composition: "", gsm: "", width: "", millName: "", colour: "", moq: "", price: "", remarks: "",
};

export default function Products() {
  const { items: products, save, remove } = useProducts();
  const { permissions } = useAuth();
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const sorted = useMemo(
    () => products.slice().sort((a, b) => (a.qualityName || "").localeCompare(b.qualityName || "")),
    [products]
  );

  const filtered = useMemo(() => {
    if (!query) return sorted;
    const q = query.toLowerCase();
    return sorted.filter((p) => [p.qualityName, p.category, p.millName, p.colour].join(" ").toLowerCase().includes(q));
  }, [sorted, query]);

  const suggestions = useMemo(() => {
    if (!query) return [];
    return filtered.map((p) => ({ id: p.id, label: p.qualityName, sublabel: `${p.category || ""}${p.millName ? ` · ${p.millName}` : ""}` }));
  }, [filtered, query]);

  const toggleSelectMode = () => { setSelectMode((v) => !v); setSelected(new Set()); };
  const toggleSelected = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const selectAll = () => setSelected(new Set(filtered.map((p) => p.id)));
  const clearSelection = () => setSelected(new Set());
  const bulkDelete = async () => {
    if (!confirm(`Remove ${selected.size} selected product(s)? This can't be undone.`)) return;
    for (const id of selected) await remove(id);
    setSelected(new Set());
  };

  return (
    <div className="flex flex-col gap-5">
      <MasterTabs active="products" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Product Master</h1>
          <p className="text-muted text-sm mt-1">{products.length} qualities</p>
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
            + Add Product
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
              {permissions?.canDelete && (
                <button onClick={bulkDelete} className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-full bg-rust/10 text-rust border border-rust/30 hover:bg-rust/20">
                  Delete Selected
                </button>
              )}
            </>
          )}
        </div>
      )}

      <SearchDropdown
        query={query}
        onQueryChange={setQuery}
        suggestions={suggestions}
        onSelect={(s) => setEditing(products.find((p) => p.id === s.id))}
        placeholder="Search quality, category, mill…"
      />

      <div className="overflow-x-auto bg-panel border border-line rounded-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted uppercase tracking-wide border-b border-line">
              {selectMode && <th className="px-4 py-3 w-8"></th>}
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">GSM / Width</th>
              <th className="px-4 py-3">Mill</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={`border-b border-line last:border-0 hover:bg-paper ${selected.has(p.id) ? "bg-ink2/5" : ""}`}>
                {selectMode && (
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelected(p.id)} />
                  </td>
                )}
                <td className="px-4 py-3 font-medium">{p.qualityName}</td>
                <td className="px-4 py-3 text-muted">{p.category}</td>
                <td className="px-4 py-3 text-muted">{p.gsm} gsm · {p.width}"</td>
                <td className="px-4 py-3 text-muted">{p.millName}</td>
                <td className="px-4 py-3 text-muted">₹{p.price}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(p)} className="text-xs font-semibold text-ink2 hover:underline mr-3">Edit</button>
                  {permissions?.canDelete && (
                    <button
                      onClick={() => { if (confirm(`Remove ${p.qualityName}?`)) remove(p.id); }}
                      className="text-xs font-semibold text-rust hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">No products match.</td></tr>
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
