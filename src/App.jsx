import { useEffect, useState, lazy, Suspense } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Customers from "./pages/Customers.jsx";
import CustomerDetail from "./pages/CustomerDetail.jsx";
import Products from "./pages/Products.jsx";
import Login from "./pages/Login.jsx";
import { AppProviders } from "./context/domains.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { ConfirmProvider } from "./context/ConfirmContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import * as dataService from "./services/dataService";
import { buildSeed } from "./data/seed";

const Tickets = lazy(() => import("./pages/Tickets.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Inventory = lazy(() => import("./pages/Inventory.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const PriceList = lazy(() => import("./pages/PriceList.jsx"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-line border-t-ink2 rounded-full animate-spin" />
    </div>
  );
}

function AuthedApp() {
  const { session, loaded } = useAuth();

  if (!loaded) return null;
  if (!session) return <Login />;

  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppProviders>
          <HashRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/customers/:id" element={<CustomerDetail />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/tickets" element={<Tickets />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/price-list" element={<PriceList />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
              </Routes>
            </Suspense>
          </HashRouter>
        </AppProviders>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      // Demo-data seeding only makes sense for the local IndexedDB backend
      // (each device starts empty). For Supabase, isSeeded()/bulkPut()
      // need a signed-in user — which doesn't exist yet at this point,
      // before the login screen even renders — so skip straight through.
      if (dataService.activeBackend === "indexeddb") {
        const seeded = await dataService.isSeeded();
        if (!seeded) {
          const { customers, products, tickets, followups } = buildSeed();
          await dataService.bulkPut(dataService.STORES.customers, customers);
          await dataService.bulkPut(dataService.STORES.products, products);
          await dataService.bulkPut(dataService.STORES.tickets, tickets);
          await dataService.bulkPut(dataService.STORES.followups, followups);
        }
      }
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-paper gap-4">
        <div className="w-14 h-14 rounded-2xl bg-ink flex items-center justify-center">
          <span className="text-white font-display font-extrabold text-xl">A</span>
        </div>
        <div className="w-6 h-6 border-2 border-line border-t-ink2 rounded-full animate-spin" />
        <span className="text-muted text-sm font-body">Loading Amihem CRM…</span>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthedApp />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
