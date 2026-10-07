// ledgerPdf.js — per-customer outstanding PDF laid out like the Ranjan Fabrics
// "Agent Outstanding With Party Eject" report (same header, columns, party band,
// Party Total / Ledger Balance rows). Layout is described as drawing ops (A4
// points) so the same page can be written to a PDF (real text, not a picture)
// and drawn on a canvas for the preview / image.

const PW = 595;
const PH = 841;
const BLUE = [0, 0, 128];
const RED = [255, 0, 0];
const BLACK = [0, 0, 0];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const p2 = (n) => String(n).padStart(2, "0");
const dmy = (iso) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y.slice(2)}`; };
const dMonY = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${p2(d)}/${MON[m - 1]}/${y}`; };
const num = (n) => Number(n).toFixed(2);

export function buildLedgerPages(group, snap, o = {}) {
  const company = (o.company || "").toUpperCase();
  const ranjan = o.format === "ranjan";
  const labels = ranjan
    ? { debit: "Debit", credit: "Credit", bal: "Balance", late: "Late" }
    : { debit: "Bill Amount", credit: "Credit", bal: "Outstanding", late: "Ageing" };
  const meta = snap.meta || {};
  const subtitle = o.subtitle || (ranjan ? "Agent Outsanding With Party Eject" : "Party Wise Outstanding");
  const period = o.period || meta.period || `As on ${dMonY(snap.asOn)}`;
  const now = new Date();
  const printed = o.printed || meta.printed || `${p2(now.getDate())}/${MON[now.getMonth()]}/${now.getFullYear()} ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;
  const [pDate, pTime = ""] = printed.split(" ");
  const partyHeader = (meta.parties && meta.parties[group.name]) || group.name;
  const agent = ranjan ? meta.agent || "" : "";
  const phones = ranjan ? meta.agentPhones || "" : "";

  const bills = group.bills;
  const T = (x, y, s, size = 7.1, extra = {}) => ({ t: "text", x, y, s: String(s), size, ...extra });
  const L = (x1, y1, x2, y2, lw = 1) => ({ t: "line", x1, y1, x2, y2, lw });

  // split rows across pages
  const firstBase = (agent ? 120.95 : 104) ;
  const contBase = 90;
  const maxBase = 786;
  const pages = [];
  let idx = 0;
  const bandH = agent ? 28.2 : 15;
  let first = true;
  do {
    const base = first ? firstBase : contBase;
    const cap = Math.floor((maxBase - base) / 9.76) + 1;
    pages.push({ first, base, rows: bills.slice(idx, idx + cap) });
    idx += cap;
    first = false;
  } while (idx < bills.length);
  const last = pages[pages.length - 1];
  const lastBase = last.base + (last.rows.length - 1) * 9.76;
  const needsTotalsPage = lastBase + 3 + 28 > 822;
  if (needsTotalsPage) pages.push({ first: false, base: contBase, rows: [], totalsOnly: true });

  const total = pages.length;
  const sum = (k) => bills.reduce((s, b) => s + (b[k] || 0), 0);
  const balance = bills.reduce((s, b) => s + b.outstanding, 0);

  return pages.map((pg, n) => {
    const ops = [];
    // frame + header
    ops.push({ t: "rect", x: 56, y: 15.7, w: 521.8, h: 809.2, lw: 1 });
    if (o.logo) ops.push({ t: "img", x: 64.2, y: 20.9, w: 48, h: 30 });
    ops.push(T(315.2, 29.3, company, 10.5, { bold: true, align: "center" }));
    ops.push(T(315, 41.4, subtitle, 6.9, { bold: true, align: "center" }));
    ops.push(T(315, 54.2, period, 6.9, { bold: true, align: "center" }));
    ops.push(T(504, 41.4, `Page ${n + 1} of ${total}`, 6.9, { bold: true }));
    ops.push(T(471.8, 52, pDate, 6.9, { bold: true }));
    if (pTime) ops.push(T(519.8, 52, pTime, 6.9, { bold: true }));
    ops.push(L(55.5, 58.4, 577.5, 58.4));
    const H = { size: 6.9, bold: true };
    ops.push(T(56.9, 67.6, "Bill No.", H.size, H));
    ops.push(T(143.2, 67.6, "Date", H.size, H));
    ops.push(T(183.6, 67.6, "Due", H.size, { ...H, align: "center" }));
    ops.push(T(183.6, 77.2, "Days", H.size, { ...H, align: "center" }));
    ops.push(T(281.7, 67.6, labels.debit, H.size, { ...H, align: "right" }));
    ops.push(T(365.8, 67.6, labels.credit, H.size, { ...H, align: "right" }));
    ops.push(T(449.9, 67.6, labels.bal, H.size, { ...H, align: "right" }));
    ops.push(T(467.4, 67.6, labels.late, H.size, { ...H, align: "center" }));
    ops.push(T(467.4, 77.2, "Days", H.size, { ...H, align: "center" }));
    ops.push(T(564.4, 67.6, "Run Balance", H.size, { ...H, align: "right" }));
    ops.push(L(56.2, 80.2, 577.5, 80.2));

    if (pg.first) {
      ops.push({ t: "rect", x: 57.4, y: 83.8, w: 518.8, h: bandH, fill: [192, 192, 192], lw: 0.4, stroke: [140, 140, 140] });
      ops.push(T(58.4, 95.2, "Party", 6.9, { bold: true, color: BLUE }));
      ops.push(T(116.4, 95.1, partyHeader, 6.9, { bold: true, color: BLUE }));
      if (agent) {
        ops.push(T(58.4, 108.2, "Agent", 6.9, { bold: true, color: RED }));
        ops.push(T(116.4, 108.2, agent, 6.9, { bold: true, color: RED }));
        if (phones) ops.push(T(494.2, 106.6, phones, 6.9, { bold: true }));
      }
    }

    // rows (running balance carried over pages)
    let before = 0;
    for (let i = 0; i < n; i++) before += pages[i].rows.reduce((s, b) => s + b.outstanding, 0);
    let run = before;
    pg.rows.forEach((b, i) => {
      const y = pg.base + i * 9.76;
      run += b.outstanding;
      ops.push(T(56.9, y, b.billNo, 7.1));
      ops.push(T(136.7, y, dmy(b.date), 7.1));
      if (b.amount) ops.push(T(281.4, y, num(b.amount), 7.1, { align: "right" }));
      if (b.credit) ops.push(T(365.5, y, num(b.credit), 7.1, { align: "right" }));
      ops.push(T(449.6, y, num(b.outstanding), 7.1, { align: "right" }));
      ops.push(T(468.3, y, b.days, 7.1, { align: "center" }));
      ops.push(T(564.2, y, num(run), 7.1, { align: "right" }));
    });

    if (n === total - 1) {
      const lineY = pg.totalsOnly ? 84 : pg.base + (pg.rows.length - 1) * 9.76 + 3.2 + 6.9;
      ops.push(L(56.2, lineY, 579, lineY));
      ops.push(T(136.7, lineY + 8.4, "Party Total", 6.9, { bold: true }));
      ops.push(T(281.4, lineY + 8.2, num(sum("amount")), 7.1, { align: "right" }));
      ops.push(T(365.5, lineY + 8.2, num(sum("credit")), 7.1, { align: "right" }));
      ops.push(T(449.6, lineY + 8.2, num(balance), 7.1, { align: "right" }));
      ops.push(T(564.4, lineY + 10.4, num(balance), 6.6, { align: "right" }));
      ops.push(L(55.5, lineY + 14.3, 579, lineY + 14.3));
      ops.push(T(136.7, lineY + 22.7, "Ledger Balance", 6.9, { bold: true }));
      ops.push(T(449.6, lineY + 22.5, num(balance), 7.1, { align: "right" }));
      ops.push(L(55.5, lineY + 26.7, 579, lineY + 26.7));
    }
    return ops;
  });
}

// ---- PDF (real text) ----
export async function ledgerPdfBlob(pages, logoDataUrl) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: [PW, PH] });
  pages.forEach((ops, i) => {
    if (i) doc.addPage([PW, PH]);
    ops.forEach((op) => {
      if (op.t === "rect") {
        doc.setLineWidth(op.lw || 1);
        doc.setDrawColor(...(op.stroke || [0, 0, 0]));
        if (op.fill) { doc.setFillColor(...op.fill); doc.rect(op.x, op.y, op.w, op.h, "FD"); } else doc.rect(op.x, op.y, op.w, op.h, "S");
      } else if (op.t === "line") {
        doc.setLineWidth(op.lw || 1);
        doc.setDrawColor(0, 0, 0);
        doc.line(op.x1, op.y1, op.x2, op.y2);
      } else if (op.t === "img") {
        if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", op.x, op.y, op.w, op.h);
      } else {
        doc.setFont("helvetica", op.bold ? "bold" : "normal");
        doc.setFontSize(op.size);
        doc.setTextColor(...(op.color || BLACK));
        doc.text(op.s, op.x, op.y, { align: op.align || "left" });
      }
    });
  });
  return doc.output("blob");
}

// ---- canvas (preview / image of one page) ----
export async function ledgerPageCanvas(ops, logoDataUrl, scale = 2) {
  const c = document.createElement("canvas");
  c.width = PW * scale;
  c.height = PH * scale;
  const ctx = c.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, PW, PH);
  let logo = null;
  if (logoDataUrl) {
    logo = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = logoDataUrl; });
  }
  const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;
  ops.forEach((op) => {
    if (op.t === "rect") {
      if (op.fill) { ctx.fillStyle = rgb(op.fill); ctx.fillRect(op.x, op.y, op.w, op.h); }
      ctx.lineWidth = op.lw || 1;
      ctx.strokeStyle = rgb(op.stroke || [0, 0, 0]);
      ctx.strokeRect(op.x, op.y, op.w, op.h);
    } else if (op.t === "line") {
      ctx.lineWidth = op.lw || 1; ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke();
    } else if (op.t === "img") {
      if (logo) ctx.drawImage(logo, op.x, op.y, op.w, op.h);
    } else {
      ctx.font = `${op.bold ? "bold " : ""}${op.size}px Arial, Helvetica, sans-serif`;
      ctx.fillStyle = rgb(op.color || BLACK);
      ctx.textAlign = op.align || "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(op.s, op.x, op.y);
    }
  });
  return c;
}
