// claimReportPdf.js — claims / differences report for the mill, sent by us (agents).
// layout "table":  company + date, title, one plain claim table with total. Nothing else.
// layout "letter": official claim letter — ref, to, subject, covering paragraph, claim table,
//                  summary by claim type, action requested, closing and signature.

import { fmtDate } from "./outstanding";
import { formatCurrency } from "./helpers";

const rs = (n) => formatCurrency(n);
const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// o: { layout, company, to, ref, asOn, items, bills, signatory, includeClosed }
export async function buildClaimReportPdf(o) {
  const letter = o.layout === "letter";
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const TW = W - 2 * M;
  let y = 0;

  const ensure = (h) => { if (y + h > H - 56) { doc.addPage(); y = 56; } };
  const line = (text, { bold = false, size = 10, gap = 6, indent = 0 } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(text, TW - indent);
    ensure(lines.length * (size + 4) + gap);
    doc.text(lines, M + indent, y);
    y += lines.length * (size + 4) + gap;
  };
  const plain = {
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, textColor: [0, 0, 0], lineColor: [150, 150, 150], lineWidth: 0.5, valign: "middle" },
    headStyles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold" },
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
  const hasClosed = list.some((d) => d.status === "closed");

  // ---- top ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(letter ? 16 : 15);
  doc.setTextColor(0, 0, 0);
  doc.text(o.company, M, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Date: ${fmtDate(o.asOn)}`, W - M, 50, { align: "right" });
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(letter ? 1.4 : 0.8);
  doc.line(M, 60, W - M, 60);
  y = 84;

  if (letter) {
    line(`Ref: ${o.ref}`, { gap: 12 });
    line("To,", { bold: true, gap: 2 });
    String(o.to || "").split("\n").filter(Boolean).forEach((l) => line(l, { gap: 1 }));
    y += 8;
    line(`Subject: Claims and differences pending settlement — as on ${fmtDate(o.asOn)}`, { bold: true, gap: 8 });
    line("Dear Sir / Madam,", { gap: 4 });
    line("We refer to the accounts of the parties serviced through us. Certain parties have raised claims and differences against the goods supplied by your mill. These are under discussion and yet to be settled. The details are given below for your review and necessary action.", { gap: 6 });
    line(`In all, ${open.length} item${open.length === 1 ? "" : "s"} amounting to Rs. ${rs(total)} are pending. Until these are settled, the amounts are not being followed up with the parties for payment.`, { gap: 12 });
  } else {
    line("Pending Claims / Differences", { bold: true, size: 12, gap: 10 });
  }

  // ---- claim table ----
  const body = list.map((d, i) => {
    const b = lookup(d.party, d.billNo);
    const rem = [d.ref ? `Ref: ${d.ref}` : "", d.note || "", d.status === "closed" ? "Closed" : ""].filter(Boolean).join("; ");
    return [i + 1, d.party, d.billNo || "-", b ? fmtDate(b.date) : "-", d.type, rs(d.amount), rem || "-"];
  });
  autoTable(doc, {
    ...plain, startY: y, margin: { left: M, right: M, bottom: 56 },
    head: [["S.No", "Party", "Bill No.", "Bill Date", "Claim Type", "Amount (Rs.)", "Remarks"]],
    body: body.length ? body : [[{ content: "No claims / differences.", colSpan: 7, styles: { halign: "center" } }]],
    foot: body.length ? [[{ content: hasClosed ? "Total (open items)" : "Total", colSpan: 5, styles: { halign: "right" } }, { content: rs(total), styles: { halign: "right" } }, ""]] : undefined,
    showFoot: "lastPage",
    columnStyles: { 0: { cellWidth: 28, halign: "center" }, 1: { cellWidth: 118 }, 2: { cellWidth: 62 }, 3: { cellWidth: 56 }, 4: { cellWidth: 62 }, 5: { cellWidth: 62, halign: "right" } },
  });
  y = doc.lastAutoTable.finalY + 18;

  if (letter) {
    // ---- summary by claim type ----
    const types = [...new Set(open.map((d) => d.type))];
    if (types.length) {
      line("Summary by claim type", { bold: true, gap: 6 });
      autoTable(doc, {
        ...plain, startY: y, margin: { left: M, right: M, bottom: 56 }, tableWidth: 300,
        head: [["Claim Type", "No. of Items", "Amount (Rs.)"]],
        body: types.map((t) => { const li = open.filter((d) => d.type === t); return [t, li.length, rs(li.reduce((s, d) => s + (Number(d.amount) || 0), 0))]; }),
        foot: [["Total", open.length, rs(total)]],
        columnStyles: { 1: { halign: "center" }, 2: { halign: "right" } },
      });
      y = doc.lastAutoTable.finalY + 18;
    }
    // ---- request + closing ----
    line("We request you to kindly:", { gap: 4 });
    [
      "check the above details against your records and confirm;",
      "let us know in writing whether each claim is accepted or not, with reasons;",
      "issue credit / debit notes, or confirm the settled amount, for accepted claims; and",
      "give us a date for final settlement so that the parties' accounts can be closed.",
    ].forEach((t, i) => line(`${i + 1}.  ${t}`, { gap: 3, indent: 12 }));
    y += 6;
    line(`This statement is as per our records as on ${fmtDate(o.asOn)} and is subject to reconciliation.`, { gap: 12 });
    ensure(120); // keep the closing and signature together
    line("Thanking you,", { gap: 2 });
    line("Yours faithfully,", { gap: 8 });
    line(`For ${o.company}`, { bold: true, gap: 34 });
    line(o.signatory ? `${o.signatory}\nAuthorised Signatory` : "Authorised Signatory", { gap: 0 });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    if (letter) doc.text(`${o.company} · ${o.ref}`, M, H - 22);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 22, { align: "right" });
  }
  return doc.output("blob");
}
