import { useState } from "react";
import { Field, TextInput, Select } from "./FormField.jsx";
import { PRODUCT_CATEGORY } from "../data/schema";

export default function QuickAddProduct({ onSave, onCancel }) {
  const [form, setForm] = useState({
    qualityName: "", category: "Cotton", gsm: "", width: "", millName: "", price: "",
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="flex flex-col gap-3">
      <p className="text-xs text-muted">Quick add — you can fill in the rest later from the Product Master.</p>
      <Field label="Quality Name *"><TextInput required autoFocus value={form.qualityName} onChange={set("qualityName")} /></Field>
      <Field label="Category">
        <Select options={PRODUCT_CATEGORY} value={form.category} onChange={set("category")} />
      </Field>
      <Field label="GSM"><TextInput value={form.gsm} onChange={set("gsm")} /></Field>
      <Field label="Mill Name"><TextInput value={form.millName} onChange={set("millName")} /></Field>
      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper">Cancel</button>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink2">Add Product</button>
      </div>
    </form>
  );
}
