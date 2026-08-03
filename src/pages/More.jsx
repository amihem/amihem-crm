import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const SECTIONS = [
  {
    label: "Insights",
    items: [
      { to: "/analytics", label: "Analytics", icon: "◔" },
      { to: "/reports", label: "Reports", icon: "▥" },
    ],
  },
  {
    label: "Planning",
    items: [
      { to: "/route-planner", label: "Route Planner", icon: "⌘" },
      { to: "/collections", label: "Seasonal Collections", icon: "❋" },
      { to: "/inventory", label: "Fabric & Hanger Inventory", icon: "▧" },
    ],
  },
];

export default function More() {
  const { session, permissions, logout } = useAuth();

  return (
    <div className="flex flex-col gap-6 sm:hidden">
      <h1 className="font-display font-extrabold text-2xl">More</h1>

      {SECTIONS.map((section) => (
        <div key={section.label}>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2 px-1">{section.label}</div>
          <div className="flex flex-col gap-2">
            {section.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="bg-panel border border-line rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium hover:bg-paper"
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2 px-1">Account</div>
        <div className="flex flex-col gap-2">
          {permissions?.canAccessSettings && (
            <Link
              to="/settings"
              className="bg-panel border border-line rounded-xl px-4 py-3 flex items-center gap-3 text-sm font-medium hover:bg-paper"
            >
              <span className="text-lg">⚙</span>
              Settings
            </Link>
          )}
          {session && (
            <div className="bg-panel border border-line rounded-xl px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-muted">{session.name} · {session.role}</span>
              <button onClick={logout} className="font-semibold text-rust">Logout</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
