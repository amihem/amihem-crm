import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const ITEMS = [
  { to: "/products", label: "Product Master", icon: "▤" },
  { to: "/analytics", label: "Analytics", icon: "◔" },
  { to: "/route-planner", label: "Route Planner", icon: "⌘" },
  { to: "/collections", label: "Seasonal Collections", icon: "❋" },
  { to: "/inventory", label: "Fabric & Hanger Inventory", icon: "▧" },
];

export default function More() {
  const { permissions } = useAuth();

  return (
    <div className="flex flex-col gap-4 sm:hidden">
      <h1 className="font-display font-extrabold text-2xl">More</h1>
      <div className="flex flex-col gap-2">
        {ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="bg-panel border border-line rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium hover:bg-paper"
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        {permissions?.canAccessSettings && (
          <Link
            to="/settings"
            className="bg-panel border border-line rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium hover:bg-paper"
          >
            <span className="text-lg">⚙</span>
            Settings
          </Link>
        )}
      </div>
    </div>
  );
}
