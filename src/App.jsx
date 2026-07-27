import { useEffect, useState } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Customers from "./pages/Customers.jsx";
import Products from "./pages/Products.jsx";
import Tickets from "./pages/Tickets.jsx";
import Reports from "./pages/Reports.jsx";
import { AppProviders } from "./context/domains.jsx";
import * as dataService from "./services/dataService";
import { buildSeed } from "./data/seed";

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const seeded = await dataService.isSeeded();
      if (!seeded) {
        const { customers, products, tickets, followups } = buildSeed();
        await dataService.bulkPut(dataService.STORES.customers, customers);
        await dataService.bulkPut(dataService.STORES.products, products);
        await dataService.bulkPut(dataService.STORES.tickets, tickets);
        await dataService.bulkPut(dataService.STORES.followups, followups);
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
    <AppProviders>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/products" element={<Products />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/reports" element={<Reports />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProviders>
  );
}

export default App;
