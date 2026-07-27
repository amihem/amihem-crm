import { NavLink, Outlet } from "react-router-dom";

const NAV = [
  { to: "/", label: "Dashboard", icon: "▦" },
  { to: "/customers", label: "Customers", icon: "◈" },
  { to: "/products", label: "Products", icon: "▤" },
  { to: "/tickets", label: "Samples", icon: "✎" },
  { to: "/reports", label: "Reports", icon: "▥" },
];

export default function AppShell() {
  return (
    <div className="min-h-screen flex flex-col sm:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex flex-col w-60 shrink-0 bg-ink text-white min-h-screen p-5 gap-1">
        <div className="mb-8">
          <div className="font-display font-extrabold text-xl leading-tight">Amihem CRM</div>
          <div className="text-xs text-white/50 mt-0.5">Sample → Order Conversion</div>
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <span className="text-base">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </aside>

      {/* Mobile top bar */}
      <header className="sm:hidden bg-ink text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="font-display font-extrabold text-lg">Amihem CRM</div>
      </header>

      <main className="flex-1 min-w-0 pb-20 sm:pb-0">
        <div className="max-w-6xl mx-auto p-4 sm:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-panel border-t border-line flex justify-around py-2 z-30">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 text-xs font-medium ${
                isActive ? "text-ink" : "text-muted"
              }`
            }
          >
            <span className="text-lg">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
