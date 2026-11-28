// paymentPlan.js — payment planning for customers whose outstanding is beyond N days (default 120).
// The mill asks us for: what has been cleared, what we expect from the customer (amount + date) and remarks.
// Entries live in settings.payPlan[partyKey] = { name, cleared, clearedOn, expected, expectedOn, remarks, updatedAt }.

import * as XLSX from "xlsx";
import { groupParties, fmtDate } from "./outstanding";
import { formatCurrency } from "./helpers";

const rs = (n) => formatCurrency(n);
const toDate = (iso) => (iso ? new Date(`${iso}T12:00:00Z`) : "");
const num = (v) => Number(String(v ?? "").replace(/,/g, "")) || 0;

function makeRow(key, name, old, net, p) {
  const amt = old.reduce((s, b) => s + b.outstanding, 0);
  const cleared = num(p.cleared);
  return {
    key, name, bills: old, n: old.length, oldest: old[0]?.days || 0, amt, net,
    cleared, clearedOn: p.clearedOn || "", balance: Math.max(0, amt - cleared),
    expected: num(p.expected), expectedOn: p.expectedOn || "", remarks: p.remarks || "", updatedAt: p.updatedAt || "",
  };
}

// bills: [{party, billNo, date, days, outstanding}]; days: threshold; plan: settings.payPlan
export function buildPlanRows({ bills, days, plan = {} }) {
  const seen = new Set();
  const rows = [];
  groupParties(bills).forEach((g) => {
    const old = g.bills.filter((b) => b.outstanding > 0 && b.days > days).sort((a, b) => b.days - a.days);
    const p = plan[g.key] || {};
    const has = p.cleared || p.expected || p.remarks || p.clearedOn || p.expectedOn;
    if (!old.length && !has) return;
    seen.add(g.key);
    rows.push(makeRow(g.key, g.name, old, g.total, p));
  });
  // customers with saved plan details who are no longer beyond the limit (paid / cleared since the last upload)
  Object.entries(plan).forEach(([key, p]) => {
    if (!seen.has(key) && p.name && (p.cleared || p.expected || p.remarks)) rows.push(makeRow(key, p.name, [], 0, p));
  });
  return rows.sort((a, b) => b.amt - a.amt || a.name.localeCompare(b.name));
}

export const planTotals = (rows) => ({
  n: rows.length,
  bills: rows.reduce((s, r) => s + r.n, 0),
  amt: rows.reduce((s, r) => s + r.amt, 0),
  cleared: rows.reduce((s, r) => s + r.cleared, 0),
  balance: rows.reduce((s, r) => s + r.balance, 0),
  expected: rows.reduce((s, r) => s + r.expected, 0),
});

// ---------- Excel: "Payment Plan" (filter + total) and "Bill Details" ----------
export function downloadPlanExcel({ rows, days }, filename) {
  const head = ["S.No", "Customer", "No. of Bills", "Oldest (Days)", `Outstanding > ${days} Days`, "Payment Cleared", "Cleared On", "Balance", "Payment Expected", "Expected On", "Remarks"];
  const body = rows.map((r, i) => [i + 1, r.name, r.n, r.oldest || "", r.amt, r.cleared || "", toDate(r.clearedOn), r.balance, r.expected || "", toDate(r.expectedOn), r.remarks]);
  const ws = XLSX.utils.aoa_to_sheet([head, ...body], { cellDates: true });
  const n = body.length;
  const last = n + 1;
  for (let r = 2; r <= last; r++) {
    ["E", "F", "H", "I"].forEach((c) => { if (ws[`${c}${r}`]?.t === "n") ws[`${c}${r}`].z = "#,##0"; });
    ["G", "J"].forEach((c) => { if (ws[`${c}${r}`]?.t === "d") ws[`${c}${r}`].z = "dd-mmm-yyyy"; });
  }
  const t = planTotals(rows);
  const tr = last + 1;
  XLSX.utils.sheet_add_aoa(ws, [["", "Total"]], { origin: `A${tr}` });
  const sum = (col, v) => (n ? { t: "n", f: `SUM(${col}2:${col}${last})`, v, z: "#,##0" } : { t: "n", v: 0, z: "#,##0" });
  ws[`C${tr}`] = { t: "n", f: n ? `SUM(C2:C${last})` : undefined, v: t.bills };
  ws[`E${tr}`] = sum("E", t.amt);
  ws[`F${tr}`] = sum("F", t.cleared);
  ws[`H${tr}`] = sum("H", t.balance);
  ws[`I${tr}`] = sum("I", t.expected);
  ws["!ref"] = `A1:K${tr}`;
  if (n) ws["!autofilter"] = { ref: `A1:K${last}` };
  ws["!cols"] = [6, 34, 11, 12, 18, 16, 12, 14, 16, 12, 44].map((w) => ({ wch: w }));

  const bhead = ["Customer", "Bill No", "Bill Date", "Days", "Outstanding"];
  const brows = [];
  rows.forEach((r) => r.bills.forEach((b) => brows.push([r.name, b.billNo, toDate(b.date), b.days, b.outstanding])));
  const bs = XLSX.utils.aoa_to_sheet([bhead, ...brows], { cellDates: true });
  for (let r = 2; r <= brows.length + 1; r++) {
    if (bs[`C${r}`]?.t === "d") bs[`C${r}`].z = "dd-mmm-yyyy";
    if (bs[`E${r}`]?.t === "n") bs[`E${r}`].z = "#,##0";
  }
  if (brows.length) bs["!autofilter"] = { ref: `A1:E${brows.length + 1}` };
  bs["!cols"] = [34, 16, 12, 8, 14].map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payment Plan");
  XLSX.utils.book_append_sheet(wb, bs, "Bill Details");
  XLSX.writeFile(wb, filename);
}

// ---------- PDF (landscape, plain table) ----------
export async function buildPlanPdf({ rows, days, asOn, company }) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text(company, M, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Date: ${fmtDate(asOn)}`, W - M, 44, { align: "right" });
  doc.setLineWidth(0.8);
  doc.line(M, 54, W - M, 54);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Payment Plan — customers with outstanding beyond ${days} days`, M, 76);

  const t = planTotals(rows);
  const body = rows.map((r, i) => [i + 1, r.name, r.n, r.oldest || "-", rs(r.amt), r.cleared ? rs(r.cleared) : "-", r.clearedOn ? fmtDate(r.clearedOn) : "-", rs(r.balance), r.expected ? rs(r.expected) : "-", r.expectedOn ? fmtDate(r.expectedOn) : "-", r.remarks || ""]);
  autoTable(doc, {
    startY: 88, margin: { left: M, right: M, bottom: 40 },
    head: [["S.No", "Customer", "Bills", "Oldest (days)", `Outstanding > ${days}d (Rs.)`, "Payment Cleared (Rs.)", "Cleared On", "Balance (Rs.)", "Payment Expected (Rs.)", "Expected On", "Remarks"]],
    body: body.length ? body : [[{ content: "No customers beyond the limit.", colSpan: 11, styles: { halign: "center" } }]],
    foot: body.length ? [[{ content: "Total", colSpan: 4, styles: { halign: "right" } }, rs(t.amt), rs(t.cleared), "", rs(t.balance), rs(t.expected), "", ""]] : undefined,
    showFoot: "lastPage",
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 3.5, textColor: [0, 0, 0], lineColor: [150, 150, 150], lineWidth: 0.5, valign: "middle" },
    headStyles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: "bold", halign: "center", fontSize: 7.5 },
    footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold", halign: "right" },
    columnStyles: { 0: { cellWidth: 26, halign: "center" }, 1: { cellWidth: 118 }, 2: { cellWidth: 30, halign: "center" }, 3: { cellWidth: 38, halign: "center" }, 4: { cellWidth: 62, halign: "right" }, 5: { cellWidth: 58, halign: "right" }, 6: { cellWidth: 60 }, 7: { cellWidth: 58, halign: "right" }, 8: { cellWidth: 62, halign: "right" }, 9: { cellWidth: 60 } },
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 20, { align: "right" });
  }
  return doc.output("blob");
}
