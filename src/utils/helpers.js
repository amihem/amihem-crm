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
