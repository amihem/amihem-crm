import { useState } from "react";
import { Field, TextInput, Select, TextArea } from "./FormField.jsx";
import { CUSTOMER_STATUS, CUSTOMER_CATEGORY } from "../data/schema";

export const BLANK_CUSTOMER = {
  name: "", company: "", city: "", state: "", country: "India",
  buyerName: "", phone: "", whatsapp: "", email: "", category: "Manufacturer",
  status: "Potential", preferredFabric: "", creditDays: "", remarks: "",
};

// Full field set — used both from the Customers page and inline from the
// Sample Ticket form's "+ New Customer" shortcut, so nothing is hidden
// either way. On save, the caller decides what happens next (the ticket
// form auto-selects the new customer and keeps you on the ticket).
export default function CustomerForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || BLANK_CUSTOMER);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="grid sm:grid-cols-2 gap-3">
      <Field label="Customer Name *"><TextInput required value={form.name} onChange={set("name")} /></Field>
      <Field label="Company"><TextInput value={form.company} onChange={set("company")} /></Field>
      <Field label="City"><TextInput value={form.city} onChange={set("city")} /></Field>
      <Field label="State"><TextInput value={form.state} onChange={set("state")} /></Field>
      <Field label="Buyer Name"><TextInput value={form.buyerName} onChange={set("buyerName")} /></Field>
      <Field label="Category">
        <Select options={CUSTOMER_CATEGORY} value={form.category} onChange={set("category")} />
      </Field>
      <Field label="Mobile No. *">
        <TextInput required type="tel" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile number" />
      </Field>
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
