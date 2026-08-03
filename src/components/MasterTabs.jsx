import { NavLink } from "react-router-dom";

export default function MasterTabs({ active }) {
  return (
    <div className="flex gap-2 border-b border-line -mt-1">
      <Tab to="/customers" label="Customers" active={active === "customers"} />
      <Tab to="/products" label="Products" active={active === "products"} />
    </div>
  );
}

function Tab({ to, label, active }) {
  return (
    <NavLink
      to={to}
      className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
        active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {label}
    </NavLink>
  );
}
