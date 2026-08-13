import { useState } from "react";
import { Field, TextInput, Select, TextArea } from "./FormField.jsx";
import FabricWeightFields from "./FabricWeightFields.jsx";
import { PRODUCT_CATEGORY } from "../data/schema";

export const BLANK_PRODUCT = {
  category: "Cotton", subCategory: "", qualityName: "", construction: "",
  composition: "", gsm: "", width: "", millName: "", colour: "", moq: "", price: "", remarks: "",
};

// Full field set — used both from the Product Master page and inline from
// the Sample Ticket form's "+ New Product" shortcut.
export default function ProductForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || BLANK_PRODUCT);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="grid sm:grid-cols-2 gap-3">
      <Field label="Quality Name *"><TextInput required value={form.qualityName} onChange={set("qualityName")} /></Field>
      <Field label="Category *">
        <Select required options={PRODUCT_CATEGORY} value={form.category} onChange={set("category")} />
      </Field>
      <Field label="Construction"><TextInput value={form.construction} onChange={set("construction")} /></Field>
      <Field label="Composition"><TextInput value={form.composition} onChange={set("composition")} /></Field>

      <FabricWeightFields
        width={form.width}
        gsm={form.gsm}
        onChangeWidth={(v) => setForm((f) => ({ ...f, width: v }))}
        onChangeGsm={(v) => setForm((f) => ({ ...f, gsm: v }))}
      />

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
