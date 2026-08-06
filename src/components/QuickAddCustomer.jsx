import { useState } from "react";
import { Field, TextInput, Select } from "./FormField.jsx";
import { CUSTOMER_CATEGORY } from "../data/schema";

export default function QuickAddCustomer({ onSave, onCancel }) {
  const [form, setForm] = useState({
    name: "", city: "", buyerName: "", phone: "", whatsapp: "",
    category: "Manufacturer", status: "Potential",
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="flex flex-col gap-3">
      <p className="text-xs text-muted">Quick add — you can fill in the rest later from the Customers page.</p>
      <Field label="Customer Name *"><TextInput required autoFocus value={form.name} onChange={set("name")} /></Field>
      <Field label="City"><TextInput value={form.city} onChange={set("city")} /></Field>
      <Field label="Phone / WhatsApp"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value, whatsapp: e.target.value })} /></Field>
      <Field label="Category">
        <Select options={CUSTOMER_CATEGORY} value={form.category} onChange={set("category")} />
      </Field>
      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-semibold text-muted hover:bg-paper">Cancel</button>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink2">Add Customer</button>
      </div>
    </form>
  );
}
