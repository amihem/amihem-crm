import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, FileText, LineChart, Package, FileBarChart, Tags, Settings as SettingsIcon, LogOut, Sun, Moon, MoreHorizontal, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import OverdueReminderPopup from "./OverdueReminderPopup.jsx";
import NetworkStatus from "./NetworkStatus.jsx";

// "Masters" consolidates Customers + Products into one nav slot — see
// MasterTabs.jsx for the sub-tab switcher rendered inside those pages.
const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Masters", icon: Users, matchAlso: ["/products"] },
  { to: "/tickets", label: "Samples", icon: FileText },
  { to: "/analytics", label: "Analytics", icon: LineChart },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/price-list", label: "Price List", icon: Tags },
  { to: "/reports", label: "Reports", icon: FileBarChart },
];

// Mobile bottom nav — Dashboard, Samples, Price List, Masters are the
// daily-use slots; everything else lives in the "More" sheet.
const MOBILE_NAV = [NAV[0], NAV[2], NAV[5], NAV[1]];
const MORE_NAV = [NAV[3], NAV[4], NAV[6]]; // Analytics, Inventory, Reports

export default function AppShell() {
  const { session, permissions, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_NAV.some((n) => pathname === n.to);

  return (
    <div className="min-h-screen flex flex-col">
      <NetworkStatus />
      <div className="flex flex-col sm:flex-row flex-1">
      <OverdueReminderPopup />
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex flex-col w-60 shrink-0 bg-ink text-white min-h-screen p-5 gap-1">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <span className="font-display font-extrabold text-sm">A</span>
          </div>
          <div>
            <div className="font-display font-extrabold text-base leading-tight">Amihem CRM</div>
            <div className="text-[11px] text-white/50">Sample → Order Conversion</div>
          </div>
        </div>
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = pathname === n.to || n.matchAlso?.some((p) => pathname === p);
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={17} strokeWidth={2} />
              {n.label}
            </NavLink>
          );
        })}

        {permissions?.canAccessSettings && (
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition mt-auto ${
                isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <SettingsIcon size={17} strokeWidth={2} />
            Settings
          </NavLink>
        )}
        {session && (
          <div className={`text-xs text-white/40 pt-3 border-t border-white/10 flex items-center justify-between ${permissions?.canAccessSettings ? "" : "mt-auto"}`}>
            <span className="truncate">{session.name} · {session.role}</span>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <button onClick={toggleTheme} className="text-white/60 hover:text-white" aria-label="Toggle dark mode">
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button onClick={logout} className="text-white/60 hover:text-white" aria-label="Logout">
                <LogOut size={15} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile top bar */}
      <header className="sm:hidden bg-ink text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="font-display font-extrabold text-xs">A</span>
          </div>
          <span className="font-display font-extrabold text-base">Amihem CRM</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="text-white/70" aria-label="Toggle dark mode">
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          {permissions?.canAccessSettings && (
            <NavLink to="/settings" className="text-white/70" aria-label="Settings">
              <SettingsIcon size={19} />
            </NavLink>
          )}
          <button onClick={logout} className="text-white/70" aria-label="Logout">
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <main className="flex-1 min-w-0 pb-20 sm:pb-0">
        <div className="max-w-6xl mx-auto p-4 sm:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile "More" sheet — Inventory, Price List */}
      {moreOpen && (
        <div className="sm:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-16 left-0 right-0 bg-panel border-t border-line rounded-t-2xl p-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-ink">More</span>
              <button onClick={() => setMoreOpen(false)} className="text-muted" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {MORE_NAV.map((n) => {
                const Icon = n.icon;
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      `flex flex-col items-center gap-1.5 py-4 rounded-xl text-xs font-medium ${
                        isActive ? "bg-ink text-white" : "bg-white text-ink border border-line"
                      }`
                    }
                  >
                    <Icon size={20} strokeWidth={2} />
                    {n.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-panel border-t border-line flex justify-around py-2 z-30">
        {MOBILE_NAV.map((n) => {
          const Icon = n.icon;
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 text-xs font-medium ${
                  isActive ? "text-ink" : "text-muted"
                }`
              }
            >
              <Icon size={19} strokeWidth={2} />
              {n.label}
            </NavLink>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 text-xs font-medium ${
            moreActive ? "text-ink" : "text-muted"
          }`}
        >
          <MoreHorizontal size={19} strokeWidth={2} />
          More
        </button>
      </nav>
      </div>
    </div>
  );
}
