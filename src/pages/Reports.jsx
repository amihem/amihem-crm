import { useCustomers, useProducts, useTickets, useFollowUps } from "../context/domains.jsx";
import { toCSV, downloadCSV, formatDate } from "../utils/helpers";
import { LOST_STAGES } from "../data/schema";

export default function Reports() {
  const { items: customers } = useCustomers();
  const { items: products } = useProducts();
  const { items: tickets } = useTickets();
  const { items: followups } = useFollowUps();

  const customerName = (id) => customers.find((c) => c.id === id)?.name || "—";
  const productName = (id) => products.find((p) => p.id === id)?.qualityName || "—";

  const reports = [
    {
      title: "Customer Report",
      desc: "All customers with contact & status.",
      count: customers.length,
      run: () => {
        const rows = customers.map((c) => ({ ...c }));
        downloadCSV("customer-report.csv", toCSV(rows, [
          { key: "name", label: "Name" }, { key: "city", label: "City" },
          { key: "buyerName", label: "Buyer" }, { key: "phone", label: "Phone" },
          { key: "category", label: "Category" }, { key: "status", label: "Status" },
        ]));
      },
    },
    {
      title: "Sample Report",
      desc: "All sample tickets with current stage.",
      count: tickets.length,
      run: () => {
        const rows = tickets.map((t) => ({
          ...t, customer: customerName(t.customerId), product: productName(t.productId),
        }));
        downloadCSV("sample-report.csv", toCSV(rows, [
          { key: "ticketNumber", label: "Ticket" }, { key: "customer", label: "Customer" },
          { key: "product", label: "Product" }, { key: "shade", label: "Shade" },
          { key: "stage", label: "Stage" }, { key: "date", label: "Date" },
        ]));
      },
    },
    {
      title: "Pending Report",
      desc: "Samples not yet received or without a decision.",
      count: tickets.filter((t) => !t.received || (!LOST_STAGES.includes(t.stage) && t.stage !== "Bulk Order" && t.stage !== "Trial Order")).length,
      run: () => {
        const rows = tickets
          .filter((t) => !t.received || (!LOST_STAGES.includes(t.stage) && t.stage !== "Bulk Order" && t.stage !== "Trial Order"))
          .map((t) => ({ ...t, customer: customerName(t.customerId), product: productName(t.productId) }));
        downloadCSV("pending-report.csv", toCSV(rows, [
          { key: "ticketNumber", label: "Ticket" }, { key: "customer", label: "Customer" },
          { key: "product", label: "Product" }, { key: "stage", label: "Stage" },
          { key: "received", label: "Received" },
        ]));
      },
    },
    {
      title: "Follow-up Report",
      desc: "Complete follow-up history across all tickets.",
      count: followups.length,
      run: () => {
        const rows = followups.map((f) => {
          const t = tickets.find((tt) => tt.id === f.ticketId);
          return { ...f, ticketNumber: t?.ticketNumber, customer: customerName(t?.customerId) };
        });
        downloadCSV("followup-report.csv", toCSV(rows, [
          { key: "ticketNumber", label: "Ticket" }, { key: "customer", label: "Customer" },
          { key: "date", label: "Date" }, { key: "mode", label: "Mode" },
          { key: "discussion", label: "Discussion" }, { key: "status", label: "Status" },
          { key: "nextFollowUpDate", label: "Next Follow-up" },
        ]));
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl">Reports</h1>
        <p className="text-muted text-sm mt-1">Export as CSV — opens in Excel.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {reports.map((r) => (
          <div key={r.title} className="bg-panel border border-line rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm">{r.title}</h3>
              <span className="text-xs text-muted">{r.count} rows</span>
            </div>
            <p className="text-xs text-muted">{r.desc}</p>
            <button
              onClick={r.run}
              disabled={r.count === 0}
              className="mt-2 self-start text-xs font-semibold px-3 py-1.5 rounded-full bg-ink text-white hover:bg-ink2 disabled:opacity-30"
            >
              Export CSV
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
