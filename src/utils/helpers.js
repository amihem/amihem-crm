import { v4 as uuidv4 } from "uuid";

export const newId = () => uuidv4();

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function daysBetween(a, b = new Date()) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

export function isOverdue(nextFollowUpDate) {
  if (!nextFollowUpDate) return false;
  return daysBetween(nextFollowUpDate, new Date()) > 0;
}

export function isToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10) === today;
}

export function nextTicketNumber(existingTickets) {
  const year = new Date().getFullYear();
  const count = existingTickets.filter((t) =>
    t.ticketNumber?.includes(`${year}`)
  ).length;
  return `AMH-${year}-${String(count + 1).padStart(4, "0")}`;
}

export function toCSV(rows, columns) {
  const header = columns.map((c) => `"${c.label}"`).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => `"${String(row[c.key] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Builds a simple table PDF and returns it as a Blob — used for both
// download and Web Share (WhatsApp) below.
export async function buildPDF(title, rows, columns) {
  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleDateString("en-IN")} — Amihem CRM`, 14, 22);
  doc.autoTable({
    startY: 28,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => String(row[c.key] ?? ""))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [27, 35, 64] }, // ink color
  });
  return doc.output("blob");
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Tries the native share sheet (works on most mobile browsers, lets the
// person pick WhatsApp directly and attaches the file). Falls back to a
// plain download + opens WhatsApp with a text note, since wa.me links
// can't attach files themselves — that's a WhatsApp/browser limitation,
// not something any web app can work around.
export async function shareOrDownloadPDF(filename, blob, whatsappPhone) {
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch {
      // person cancelled the share sheet — fall through to download
    }
  }
  downloadBlob(filename, blob);
  if (whatsappPhone) {
    const digits = String(whatsappPhone).replace(/\D/g, "");
    const withCountry = digits.length === 10 ? `91${digits}` : digits;
    window.open(`https://wa.me/${withCountry}?text=${encodeURIComponent("Sharing a report — please find the PDF attached (downloaded to your device, attach it here).")}`, "_blank");
  }
  return "downloaded";
}
