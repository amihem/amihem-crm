// claimReportPdf.js — simple table-format statement of claims / differences for the mill.
// Letterhead, subject, one detail table (with total), summary by claim type, short closing, signature.

import { fmtDate } from "./outstanding";
import { formatCurrency } from "./helpers";

const NAVY = [20, 33, 61];
const rs = (n) => formatCurrency(n);
const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// o: { company, to, ref, asOn, items, bills, signatory, includeClosed }
export async function buildClaimReportPdf(o) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const TW = W - 2 * M;
  let y = 0;

  const ensure = (h) => { if (y + h > H - 56) { doc.addPage(); y = 56; } };
  const para = (text, { bold = false, size = 9.5, gap = 8 } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(31, 41, 55);
    const lines = doc.splitTextToSize(text, TW);
    ensure(lines.length * (size + 3.5) + gap);
    doc.text(lines, M, y);
    y += lines.length * (size + 3.5) + gap;
  };
  const label = (text) => {
    ensure(34);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text(text, M, y);
    y += 8;
  };
  const tableStyle = {
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.2, cellPadding: 4, textColor: [31, 41, 55], lineColor: [190, 195, 205], lineWidth: 0.5, valign: "middle" },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", halign: "center" },
    footStyles: { fillColor: [229, 231, 235], textColor: NAVY, fontStyle: "bold" },
  };

  const lookup = (party, billNo) => {
    const rk = norm(billNo);
    return rk ? (o.bills || []).find((b) => norm(b.party) === norm(party) && norm(b.billNo) === rk) || null : null;
  };
  const list = (o.items || [])
    .filter((d) => o.includeClosed || d.status !== "closed")
    .sort((a, b) => a.party.localeCompare(b.party) || String(a.billNo).localeCompare(String(b.billNo)));
  const open = list.filter((d) => d.status !== "closed");
  const total = open.reduce((t, d) => t + (Number(d.amount) || 0), 0);

  // ---- letterhead ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text(o.company, M, 50);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1.4);
  doc.line(M, 60, W - M, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(31, 41, 55);
  doc.text(`Ref: ${o.ref}`, M, 80);
  doc.text(`Date: ${fmtDate(o.asOn)}`, W - M, 80, { align: "right" });
  y = 104;
  para("To,", { bold: true, gap: 2 });
  String(o.to || "").split("\n").filter(Boolean).forEach((l) => para(l, { gap: 1 }));
  y += 8;
  para(`Subject: Claims and differences pending settlement — as on ${fmtDate(o.asOn)}`, { bold: true, size: 10, gap: 8 });
  para("Dear Sir / Madam,", { gap: 4 });
  para("Please find below the claims and differences raised by our parties against supplies from your mill, which are pending settlement. Kindly review and confirm.", { gap: 12 });

  // ---- detail table ----
  label("Claims / differences — details");
  const hasClosed = list.some((d) => d.status === "closed");
  const body = list.map((d, i) => {
    const b = lookup(d.party, d.billNo);
    const rem = [d.ref ? `Ref: ${d.ref}` : "", d.note || "", d.status === "closed" ? "Closed" : ""].filter(Boolean).join("; ");
    return [i + 1, d.party, d.billNo || "-", b ? fmtDate(b.date) : "-", d.type, rs(d.amount), rem || "-"];
  });
  autoTable(doc, {
    ...tableStyle, startY: y, margin: { left: M, right: M, bottom: 56 },
    head: [["S.No", "Party", "Bill No.", "Bill Date", "Claim Type", "Claim Amt (Rs.)", "Remarks"]],
    body: body.length ? body : [[{ content: "No claims / differences.", colSpan: 7, styles: { halign: "center" } }]],
    foot: body.length ? [[{ content: hasClosed ? "TOTAL (OPEN ITEMS)" : "TOTAL", colSpan: 5, styles: { halign: "right" } }, { content: rs(total), styles: { halign: "right" } }, ""]] : undefined,
    showFoot: "lastPage",
    columnStyles: { 0: { cellWidth: 28, halign: "center" }, 1: { cellWidth: 118 }, 2: { cellWidth: 62 }, 3: { cellWidth: 56 }, 4: { cellWidth: 62 }, 5: { cellWidth: 62, halign: "right" } },
  });
  y = doc.lastAutoTable.finalY + 18;

  // ---- summary table ----
  const types = [...new Set(open.map((d) => d.type))];
  if (types.length) {
    label("Summary by claim type");
    autoTable(doc, {
      ...tableStyle, startY: y, margin: { left: M, right: M, bottom: 56 },
      head: [["Claim Type", "No. of Items", "Claim Amt (Rs.)"]],
      body: types.map((t) => { const li = open.filter((d) => d.type === t); return [t, li.length, rs(li.reduce((s, d) => s + (Number(d.amount) || 0), 0))]; }),
      foot: [["Total", open.length, rs(total)]],
      tableWidth: 300,
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 18;
  }

  // ---- closing ----
  para("Kindly confirm your acceptance (or reasons otherwise) and the settlement schedule at the earliest. This statement is as per our records on the date above and is subject to reconciliation.", { gap: 10 });
  para("Yours faithfully,", { gap: 4 });
  ensure(80);
  para(`For ${o.company}`, { bold: true, gap: 34 });
  para(o.signatory ? `${o.signatory}\nAuthorised Signatory` : "Authorised Signatory", { gap: 0 });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.text(`${o.company} · Claims and differences · ${o.ref}`, M, H - 22);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 22, { align: "right" });
  }
  return doc.output("blob");
}
