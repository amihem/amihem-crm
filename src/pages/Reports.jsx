import { useState } from "react";
import { FileSpreadsheet, FileText, Share2, X } from "lucide-react";
import { useCustomers, useProducts, useTickets, useFollowUps } from "../context/domains.jsx";
import { useToast } from "../context/ToastContext.jsx";
import Modal from "../components/Modal.jsx";
import { toCSV, downloadCSV, buildPDF, downloadBlob, shareOrDownloadPDF } from "../utils/helpers";
import { LOST_STAGES } from "../data/schema";

export default function Reports() {
  const { items: customers } = useCustomers();
  const { items: products } = useProducts();
  const { items: tickets } = useTickets();
  const { items: followups } = useFollowUps();
  const showToast = useToast();
  const [busy, setBusy] = useState(null);
  const [pdfMenuFor, setPdfMenuFor] = useState(null); // report currently showing the PDF/Share choice

  const customerName = (id) => customers.find((c) => c.id === id)?.name || "—";
  const productName = (id) => products.find((p) => p.id === id)?.qualityName || "—";

  const reports = [
    {
      title: "Customer List",
      whenToUse: "Full customer database — names, cities, contact numbers, status.",
      rows: () => customers.map((c) => ({ ...c })),
      columns: [
        { key: "name", label: "Name" }, { key: "city", label: "City" },
        { key: "buyerName", label: "Buyer" }, { key: "phone", label: "Phone" },
        { key: "category", label: "Category" }, { key: "status", label: "Status" },
      ],
      count: customers.length,
    },
    {
      title: "All Samples",
      whenToUse: "Every sample ticket ever raised, with its current stage.",
      rows: () => tickets.map((t) => ({ ...t, customer: customerName(t.customerId), product: productName(t.productId) })),
      columns: [
        { key: "ticketNumber", label: "Ticket" }, { key: "customer", label: "Customer" },
        { key: "product", label: "Product" }, { key: "shade", label: "Shade" },
        { key: "stage", label: "Stage" }, { key: "date", label: "Date" },
      ],
      count: tickets.length,
    },
    {
      title: "Pending Samples",
      whenToUse: "Samples awaiting a result — not yet received back, or no decision yet.",
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
      title: "Follow-up History",
      whenToUse: "Every call/WhatsApp/meeting logged, across all tickets — a full activity trail.",
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

  const handleExcel = (report) => {
    downloadCSV(`${slug(report.title)}.csv`, toCSV(report.rows(), report.columns));
    showToast(`${report.title} downloaded — opens in Excel or Google Sheets.`, "success");
  };

  const handlePDFDownload = async (report) => {
    setBusy(report.title + "-pdf");
    try {
      const blob = await buildPDF(report.title, report.rows(), report.columns);
      downloadBlob(`${slug(report.title)}.pdf`, blob);
      showToast(`${report.title} downloaded as PDF.`, "success");
    } finally {
      setBusy(null);
      setPdfMenuFor(null);
    }
  };

  const handlePDFShare = async (report) => {
    setBusy(report.title + "-pdf");
    try {
      const blob = await buildPDF(report.title, report.rows(), report.columns);
      const result = await shareOrDownloadPDF(`${slug(report.title)}.pdf`, blob);
      showToast(
        result === "downloaded"
          ? "Sharing isn't supported here — downloaded instead. Attach it in WhatsApp manually."
          : "Shared.",
        result === "downloaded" ? "info" : "success"
      );
    } finally {
      setBusy(null);
      setPdfMenuFor(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl">Reports</h1>
        <p className="text-muted text-sm mt-1">
          Pick a report, then either download it or share it — that's the whole flow.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {reports.map((r) => (
          <div key={r.title} className="bg-panel border border-line rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-bold text-sm">{r.title}</h3>
                <span className="text-xs text-muted bg-paper rounded-full px-2 py-0.5 border border-line">{r.count} rows</span>
              </div>
              <p className="text-xs text-muted mt-1">{r.whenToUse}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleExcel(r)}
                disabled={r.count === 0}
                title="Download as Excel/CSV"
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-ink text-white hover:bg-ink2 disabled:opacity-30"
              >
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button
                onClick={() => setPdfMenuFor(r)}
                disabled={r.count === 0 || busy === r.title + "-pdf"}
                title="Download or share as PDF"
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-panel border border-line hover:bg-paper disabled:opacity-30"
              >
                <FileText size={14} /> {busy === r.title + "-pdf" ? "Working…" : "PDF"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!pdfMenuFor} onClose={() => setPdfMenuFor(null)} title={pdfMenuFor?.title || ""}>
        {pdfMenuFor && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => handlePDFDownload(pdfMenuFor)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line hover:bg-paper text-left"
            >
              <FileText size={18} className="text-ink2 shrink-0" />
              <div>
                <div className="text-sm font-semibold">Download PDF</div>
                <div className="text-xs text-muted">Saves the file to this device.</div>
              </div>
            </button>
            <button
              onClick={() => handlePDFShare(pdfMenuFor)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line hover:bg-paper text-left"
            >
              <Share2 size={18} className="text-loom shrink-0" />
              <div>
                <div className="text-sm font-semibold">Share via WhatsApp</div>
                <div className="text-xs text-muted">Opens your phone's share sheet — pick WhatsApp to attach directly.</div>
              </div>
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
