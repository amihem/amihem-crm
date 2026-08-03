import { useState } from "react";
import { useCustomers, useProducts, useTickets, useFollowUps } from "../context/domains.jsx";
import { toCSV, downloadCSV, buildPDF, downloadBlob, shareOrDownloadPDF } from "../utils/helpers";
import { LOST_STAGES } from "../data/schema";

export default function Reports() {
  const { items: customers } = useCustomers();
  const { items: products } = useProducts();
  const { items: tickets } = useTickets();
  const { items: followups } = useFollowUps();
  const [busy, setBusy] = useState(null); // report title currently generating

  const customerName = (id) => customers.find((c) => c.id === id)?.name || "—";
  const productName = (id) => products.find((p) => p.id === id)?.qualityName || "—";

  const reports = [
    {
      title: "Customer Report",
      desc: "All customers with contact & status.",
      rows: () => customers.map((c) => ({ ...c })),
      columns: [
        { key: "name", label: "Name" }, { key: "city", label: "City" },
        { key: "buyerName", label: "Buyer" }, { key: "phone", label: "Phone" },
        { key: "category", label: "Category" }, { key: "status", label: "Status" },
      ],
      count: customers.length,
    },
    {
      title: "Sample Report",
      desc: "All sample tickets with current stage.",
      rows: () => tickets.map((t) => ({ ...t, customer: customerName(t.customerId), product: productName(t.productId) })),
      columns: [
        { key: "ticketNumber", label: "Ticket" }, { key: "customer", label: "Customer" },
        { key: "product", label: "Product" }, { key: "shade", label: "Shade" },
        { key: "stage", label: "Stage" }, { key: "date", label: "Date" },
      ],
      count: tickets.length,
    },
    {
      title: "Pending Report",
      desc: "Samples not yet received or without a decision.",
      rows: () => tickets
        .filter((t) => !t.received || (!LOST_STAGES.includes(t.stage) && t.stage !== "Bulk Order" && t.stage !== "Trial Order"))
        .map((t) => ({ ...t, customer: customerName(t.customerId), product: productName(t.productId) })),
      columns: [
        { key: "ticketNumber", label: "Ticket" }, { key: "customer", label: "Customer" },
        { key: "product", label: "Product" }, { key: "stage", label: "Stage" },
        { key: "received", label: "Received" },
      ],
      get count() {
        return tickets.filter((t) => !t.received || (!LOST_STAGES.includes(t.stage) && t.stage !== "Bulk Order" && t.stage !== "Trial Order")).length;
      },
    },
    {
      title: "Follow-up Report",
      desc: "Complete follow-up history across all tickets.",
      rows: () => followups.map((f) => {
        const t = tickets.find((tt) => tt.id === f.ticketId);
        return { ...f, ticketNumber: t?.ticketNumber, customer: customerName(t?.customerId) };
      }),
      columns: [
        { key: "ticketNumber", label: "Ticket" }, { key: "customer", label: "Customer" },
        { key: "date", label: "Date" }, { key: "mode", label: "Mode" },
        { key: "discussion", label: "Discussion" }, { key: "status", label: "Status" },
        { key: "nextFollowUpDate", label: "Next Follow-up" },
      ],
      count: followups.length,
    },
  ];

  const slug = (title) => title.toLowerCase().replace(/\s+/g, "-");

  const handleCSV = (report) => {
    downloadCSV(`${slug(report.title)}.csv`, toCSV(report.rows(), report.columns));
  };

  const handlePDF = async (report) => {
    setBusy(report.title + "-pdf");
    try {
      const blob = await buildPDF(report.title, report.rows(), report.columns);
      downloadBlob(`${slug(report.title)}.pdf`, blob);
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async (report) => {
    setBusy(report.title + "-share");
    try {
      const blob = await buildPDF(report.title, report.rows(), report.columns);
      const result = await shareOrDownloadPDF(`${slug(report.title)}.pdf`, blob);
      if (result === "downloaded") {
        alert("Your device doesn't support direct sharing — the PDF downloaded instead. Attach it in WhatsApp manually.");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl">Reports</h1>
        <p className="text-muted text-sm mt-1">Export as Excel (CSV) or PDF, or share the PDF directly.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {reports.map((r) => (
          <div key={r.title} className="bg-panel border border-line rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm">{r.title}</h3>
              <span className="text-xs text-muted">{r.count} rows</span>
            </div>
            <p className="text-xs text-muted">{r.desc}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              <button
                onClick={() => handleCSV(r)}
                disabled={r.count === 0}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-ink text-white hover:bg-ink2 disabled:opacity-30"
              >
                Export CSV
              </button>
              <button
                onClick={() => handlePDF(r)}
                disabled={r.count === 0 || busy === r.title + "-pdf"}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-panel border border-line hover:bg-paper disabled:opacity-30"
              >
                {busy === r.title + "-pdf" ? "Generating…" : "Export PDF"}
              </button>
              <button
                onClick={() => handleShare(r)}
                disabled={r.count === 0 || busy === r.title + "-share"}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-loom/10 text-loom border border-loom/30 hover:bg-loom/20 disabled:opacity-30"
              >
                {busy === r.title + "-share" ? "Preparing…" : "Share PDF (WhatsApp)"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted">
        "Share PDF" opens your device's share sheet (works on most phones) — pick WhatsApp
        and the file attaches directly. On desktop, or if sharing isn't supported, it
        downloads the PDF instead so you can attach it manually.
      </p>
    </div>
  );
}
