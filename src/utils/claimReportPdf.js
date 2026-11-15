// claimReportPdf.js — formal statement of claims / differences to be shared with the mill.
// Letter format: letterhead, subject, covering paragraph, type-wise summary, party-wise detail
// with sub-totals, requests for action, signature block, page numbers.

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
  const para = (text, { bold = false, size = 9.5, gap = 8, indent = 0 } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(31, 41, 55);
    const lines = doc.splitTextToSize(text, TW - indent);
    ensure(lines.length * (size + 3.5) + gap);
    doc.text(lines, M + indent, y);
    y += lines.length * (size + 3.5) + gap;
  };
  const heading = (text) => {
    ensure(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(text.toUpperCase(), M, y);
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.6);
    doc.line(M, y + 4, W - M, y + 4);
    y += 16;
  };

  const lookup = (party, billNo) => {
    const rk = norm(billNo);
    if (!rk) return null;
    return (o.bills || []).find((b) => norm(b.party) === norm(party) && norm(b.billNo) === rk) || null;
  };
  const open = (o.items || []).filter((d) => d.status !== "closed");
  const closed = (o.items || []).filter((d) => d.status === "closed");
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
  para(`Subject: Statement of claims and differences pending settlement — accounts as on ${fmtDate(o.asOn)}`, { bold: true, size: 10, gap: 10 });
  para("Dear Sir / Madam,", { gap: 6 });
  para("We refer to the accounts of the parties serviced through us. Certain parties have raised claims and differences against the goods supplied by your mill, on account of garment claims, rate differences and other matters. These remain under discussion and are yet to be settled. The particulars are set out in this statement for your review and necessary action.");
  para(`In all, ${open.length} item${open.length === 1 ? "" : "s"} aggregating Rs. ${rs(total)} are pending resolution. Until the matters are settled, these amounts are not being pursued for collection from the respective parties.`, { gap: 10 });

  // ---- 1. summary ----
  heading("1. Summary of pending claims");
  const types = [...new Set(open.map((d) => d.type))];
  const sumRows = types.map((t) => {
    const li = open.filter((d) => d.type === t);
    return [t, li.length, new Set(li.map((d) => norm(d.party))).size, rs(li.reduce((s, d) => s + (Number(d.amount) || 0), 0))];
  });
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, bottom: 56 },
    head: [["Claim type", "No. of items", "No. of parties", "Claim amount (Rs.)"]],
    body: sumRows.length ? sumRows : [["—", 0, 0, "0"]],
    foot: [["Total", open.length, new Set(open.map((d) => norm(d.party))).size, rs(total)]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, textColor: [31, 41, 55], lineColor: [209, 213, 219], lineWidth: 0.4 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [229, 231, 235], textColor: NAVY, fontStyle: "bold" },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "right" } },
  });
  y = doc.lastAutoTable.finalY + 18;

  // ---- 2. party-wise detail ----
  heading("2. Party-wise details of claims / differences");
  const groups = new Map();
  [...open]
    .sort((a, b) => a.party.localeCompare(b.party) || (lookup(a.party, a.billNo)?.date || "").localeCompare(lookup(b.party, b.billNo)?.date || ""))
    .forEach((d) => { const k = norm(d.party); if (!groups.has(k)) groups.set(k, { party: d.party, items: [] }); groups.get(k).items.push(d); });
  const SUB = { fontStyle: "bold", fillColor: [243, 244, 246], textColor: NAVY };
  const body = [];
  let n = 0;
  groups.forEach((g) => {
    g.items.forEach((d) => {
      n++;
      const b = lookup(d.party, d.billNo);
      const rem = [
        d.ref ? `Ref: ${d.ref}` : "",
        d.note || "",
        d.oldAmt > 0 && Math.abs(d.oldAmt - d.amount) > 0.5 ? `Outstanding when marked: Rs. ${rs(d.oldAmt)}` : "",
      ].filter(Boolean).join("; ");
      body.push([n, d.party, d.billNo || "-", b ? fmtDate(b.date) : "-", d.type, b && b.amount > 0 ? rs(b.amount) : "-", rs(d.amount), rem || "-"]);
    });
    if (g.items.length > 1) body.push([{ content: `Sub-total — ${g.party}`, colSpan: 6, styles: { ...SUB, halign: "right" } }, { content: rs(g.items.reduce((s, d) => s + (Number(d.amount) || 0), 0)), styles: { ...SUB, halign: "right" } }, { content: "", styles: SUB }]);
  });
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, bottom: 56 },
    head: [["S.No", "Party", "Bill No.", "Bill Date", "Claim type", "Bill Amt (Rs.)", "Claim Amt (Rs.)", "Remarks"]],
    body: body.length ? body : [[{ content: "No open claims / differences.", colSpan: 8, styles: { halign: "center" } }]],
    foot: body.length ? [[{ content: "TOTAL CLAIM AMOUNT", colSpan: 6, styles: { halign: "right" } }, { content: rs(total), styles: { halign: "right" } }, ""]] : undefined,
    showFoot: "lastPage",
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.8, cellPadding: 3.5, textColor: [31, 41, 55], lineColor: [209, 213, 219], lineWidth: 0.4, valign: "middle" },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5, halign: "center" },
    footStyles: { fillColor: [229, 231, 235], textColor: NAVY, fontStyle: "bold", fontSize: 8.5 },
    columnStyles: { 0: { cellWidth: 26, halign: "center" }, 1: { cellWidth: 100 }, 2: { cellWidth: 56 }, 3: { cellWidth: 50 }, 4: { cellWidth: 58 }, 5: { cellWidth: 52, halign: "right" }, 6: { cellWidth: 56, halign: "right" } },
  });
  y = doc.lastAutoTable.finalY + 18;

  // ---- 3. closed items (optional) ----
  if (o.includeClosed && closed.length) {
    heading("3. Items already closed / settled (for reference)");
    autoTable(doc, {
      startY: y, margin: { left: M, right: M, bottom: 56 },
      head: [["Party", "Bill No.", "Claim type", "Amount (Rs.)", "Closed on"]],
      body: closed.map((d) => [d.party, d.billNo || "-", d.type, rs(d.amount), d.closedOn ? fmtDate(d.closedOn) : "-"]),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7.8, cellPadding: 3.5, textColor: [31, 41, 55], lineColor: [209, 213, 219], lineWidth: 0.4 },
      headStyles: { fillColor: [107, 114, 128], textColor: 255, fontStyle: "bold" },
      columnStyles: { 3: { halign: "right" } },
    });
    y = doc.lastAutoTable.finalY + 18;
  }

  // ---- requests / closing ----
  heading(`${o.includeClosed && closed.length ? "4" : "3"}. Action requested`);
  para("We request you to kindly:", { gap: 4 });
  [
    "verify the above particulars against your records and confirm the claim details;",
    "advise in writing your acceptance or otherwise of each item, with reasons;",
    "issue credit / debit notes, or confirm the settled amount, for the items accepted; and",
    "indicate a time schedule for final settlement so that the accounts of the concerned parties may be closed.",
  ].forEach((t, i) => para(`${i + 1}.  ${t}`, { gap: 3, indent: 12 }));
  y += 6;
  para(`This statement is prepared from the records available with us as on ${fmtDate(o.asOn)} and is subject to reconciliation. Supporting particulars, as available with us, will be furnished on request.`, { gap: 12 });
  para("Thanking you,", { gap: 2 });
  para("Yours faithfully,", { gap: 10 });
  ensure(80);
  para(`For ${o.company}`, { bold: true, gap: 34 });
  para(o.signatory ? `${o.signatory}\nAuthorised Signatory` : "Authorised Signatory", { gap: 0 });

  // ---- page footer ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.text(`${o.company} · Statement of claims and differences · ${o.ref}`, M, H - 22);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 22, { align: "right" });
  }
  return doc.output("blob");
}
