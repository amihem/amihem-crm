// reportPdf.js — branded, professional PDF for the Outstanding reports
// (letterhead band, KPI strip, striped table, totals row, page numbers).

import { fmtDate } from "./outstanding";

const NAVY = [20, 33, 61];
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// opts: { company, title, asOn, kpis:[{label,value}], head:[...], body:[[...]], foot:[...]|null,
//         align:[...'left'|'right'|'center'], colColors:{colIndex:'#hex'}, landscape, colWidths:{idx:pt} }
export async function buildReportPdf(o) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: o.landscape ? "landscape" : "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const M = 32;

  const band = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 62, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(o.company, M, 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(174, 184, 204);
    doc.text(o.title.toUpperCase(), M, 46);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`As on ${fmtDate(o.asOn)}`, W - M, 28, { align: "right" });
  };

  let y = 82;
  const first = (() => { band(); return true; })();
  if (first && o.kpis?.length) {
    const n = o.kpis.length;
    const gap = 10;
    const w = (W - 2 * M - gap * (n - 1)) / n;
    o.kpis.forEach((k, i) => {
      const x = M + i * (w + gap);
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(x, y, w, 42, 5, 5, "F");
      doc.setTextColor(107, 114, 128);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(k.label.toUpperCase(), x + 10, y + 15);
      doc.setTextColor(...(k.color ? hexRgb(k.color) : NAVY));
      doc.setFontSize(12.5);
      doc.text(String(k.value).replace(/₹/g, "Rs. "), x + 10, y + 33);
    });
    y += 58;
  }

  const colStyles = {};
  (o.align || []).forEach((a, i) => { colStyles[i] = { halign: a }; });
  Object.entries(o.colWidths || {}).forEach(([i, w]) => { colStyles[i] = { ...(colStyles[i] || {}), cellWidth: w }; });

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: 76, bottom: 34 },
    head: [o.head],
    body: o.body,
    foot: o.foot ? [o.foot] : undefined,
    showFoot: "lastPage",
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 4, bottom: 4, left: 5, right: 5 }, textColor: [31, 41, 55], lineColor: [229, 231, 235], lineWidth: 0 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    footStyles: { fillColor: [229, 231, 235], textColor: NAVY, fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    columnStyles: colStyles,
    didParseCell: (d) => {
      const c = o.colColors?.[d.column.index];
      if (!c) return;
      if (d.section === "head") d.cell.styles.fillColor = hexRgb(c);
      else if (d.section === "body" && d.cell.raw && d.cell.raw !== "–") { d.cell.styles.textColor = hexRgb(c); d.cell.styles.fontStyle = "bold"; }
    },
    didDrawPage: (d) => {
      if (d.pageNumber > 1) band();
      const H = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128);
      doc.text(`${o.company} · ${o.title} · Generated ${fmtDate(new Date().toISOString().slice(0, 10))}`, M, H - 16);
      doc.text(`Page ${d.pageNumber} of {total}`, W - M, H - 16, { align: "right" });
    },
  });
  doc.putTotalPages("{total}");
  return doc.output("blob");
}
