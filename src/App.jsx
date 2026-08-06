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
import * as dataService from "./services/dataService";
import { buildSeed } from "./data/seed";

const Tickets = lazy(() => import("./pages/Tickets.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Inventory = lazy(() => import("./pages/Inventory.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));

function PageLoader() {
  return <div className="text-sm text-muted py-10 text-center">Loading…</div>;
}

function AuthedApp() {
  const { session, loaded } = useAuth();

  if (!loaded) return null;
  if (!session) return <Login />;

  return (
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
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </AppProviders>
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
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <span className="text-muted text-sm font-body">Loading Amihem CRM…</span>
      </div>
    );
  }

  return (
    <AuthProvider>
      <AuthedApp />
    </AuthProvider>
  );
}

export default App;
