// advicePdf.js — "Payment Advice" sent to the supplier for the payments collected
// in a Tuesday→Monday week. Same layout as the existing advice (A4 landscape,
// sender block, supplier + ADV NO./DATE, grey 12-column table, Total, amount in words).

export const PW = 841.89;
export const PH = 595.28;
const COLS = [1.5, 136.4, 200.1, 329.9, 400.3, 461.9, 487.5, 533.8, 580.7, 637.9, 700.3, 794.2, 839.7];
const HEAD = ["Party Name", "Deposit Date", "INVOICE No", "INV. DATE", "BILL AMT.", "%", "LESS CD", "GR", "Freight From Last GR", "AMOUNT", "Chq No. / Tran ID", "Mode"];
const ROW_H = 12;

export const DEFAULT_ADVICE_PROFILE = {
  supplierName: "M/s RANJAN FABRICS PVT LTD",
  supplierLines: ["RIICO IND AREA", "BHILWARA, RAJASTHAN"],
  bank: "HDFC Account No. 50200074927484",
  senderName: "R. P. AGENCY / RAJEEV JAIN",
  senderLines: ["9/1644, GANDHI NAGAR", "DELHI- 110031", "M. No.: +91-85060 63000, Email:- navkarfabrics09@gmail.com / rajeevzan@gmail.com"],
  forLine: "For RP AGENCY / RAJEEV JAIN",
  note: "Kindly acknowledge the Receipt and sent Credit Note as per the details given above.",
  supplierPhone: "",
};

const IN = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
export const inFmt = (n) => IN.format(Number(n) || 0);
export const dmyFull = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}-${m}-${y}`; };

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`);
export function inWords(amount) {
  let n = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - n) * 100);
  if (!n && !paise) return "Rupees Zero Only";
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thou = Math.floor(n / 1e3); n %= 1e3;
  const hund = Math.floor(n / 100); const rest = n % 100;
  if (crore) parts.push(`${two(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thou) parts.push(`${two(thou)} Thousand`);
  if (hund) parts.push(`${ONES[hund]} Hundred`);
  if (rest) parts.push(two(rest));
  return `Rupees ${parts.join(" ")}${paise ? ` and ${two(paise)} Paise` : ""} Only`;
}

const clip = (s, w, size) => { const max = Math.max(3, Math.floor((w - 6) / (size * 0.53))); s = String(s ?? ""); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };
const dash = (n) => (n ? inFmt(n) : "-");
const blank = (n) => (n ? inFmt(n) : "");

export function adviceTotals(rows) {
  const sum = (k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  return { bill: sum("billAmt"), cd: sum("cd"), gr: sum("gr"), freight: sum("freight"), amount: sum("amount") };
}

// advice: { no, date(iso), rows:[{party, depositDate, invoices, invDate, billAmt, pct, cd, gr, freight, amount, ref, mode}] }
export function buildAdvicePages(advice, profile) {
  const P = { ...DEFAULT_ADVICE_PROFILE, ...(profile || {}) };
  const rows = advice.rows;
  const T = (x, y, s, size = 8.6, extra = {}) => ({ t: "text", x, y, s: String(s), size, ...extra });
  const L = (x1, y1, x2, y2, lw = 0.8) => ({ t: "line", x1, y1, x2, y2, lw });

  // paging
  const cap1 = 22;
  const capN = 38;
  const chunks = [];
  let i = 0;
  let first = true;
  do {
    const cap = first ? cap1 : capN;
    chunks.push(rows.slice(i, i + cap));
    i += cap;
    first = false;
  } while (i < rows.length);
  const lastLen = chunks[chunks.length - 1].length;
  const fits = chunks.length === 1 ? lastLen <= 16 : lastLen <= 31;
  if (!fits) chunks.push([]);

  return chunks.map((chunk, pi) => {
    const ops = [];
    const isFirst = pi === 0;
    const isLast = pi === chunks.length - 1;
    let top = 201.1;
    if (isFirst) {
      ops.push(T(PW / 2, 52, P.senderName, 9.6, { bold: true, align: "center" }));
      P.senderLines.forEach((l, k) => ops.push(T(PW / 2, 65 + k * 13, l, 8.8, { align: "center" })));
      ops.push(T(PW / 2, 118, "PAYMENT ADVICE", 9.6, { bold: true, align: "center" }));
      ops.push(T(3.4, 131.5, P.supplierName, 8.6, { bold: true }));
      P.supplierLines.forEach((l, k) => ops.push(T(3.4, 145 + k * 13.5, l, 8.6)));
      ops.push(T(640, 131.5, "ADV NO.", 8.6));
      ops.push(T(741, 131.5, advice.no, 8.6, { bold: true }));
      ops.push(T(640, 145, "DATE:", 8.6));
      ops.push(T(721, 145, dmyFull(advice.date), 8.6));
      ops.push(T(3.4, 184, `We have deposited Payments to your ${P.bank} as per details given below:-`, 8.6));
    } else {
      top = 40;
      ops.push(T(3.4, 28, `${P.supplierName} — Payment Advice No. ${advice.no} (continued)`, 8.6, { bold: true }));
    }

    // header
    const hb = top + 33.1;
    ops.push({ t: "rect", x: COLS[0], y: top, w: COLS[12] - COLS[0], h: 33.1, fill: [192, 192, 192], stroke: [0, 0, 0], lw: 0.8 });
    HEAD.forEach((h, k) => {
      const cx = (COLS[k] + COLS[k + 1]) / 2;
      if (k === 8) { ["Freight", "From Last", "GR"].forEach((s, j) => ops.push(T(cx, top + 9.5 + j * 10.8, s, 8.2, { bold: true, align: "center" }))); }
      else ops.push(T(cx, top + 20.2, h, 8.2, { bold: true, align: "center" }));
    });

    // rows
    chunk.forEach((r, k) => {
      const y = hb + k * ROW_H;
      const b = y + 8.5;
      const c = (idx) => [COLS[idx], COLS[idx + 1]];
      ops.push(T(COLS[0] + 2, b, clip(r.party, COLS[1] - COLS[0], 7.3), 7.3));
      ops.push(T((COLS[1] + COLS[2]) / 2, b, dmyFull(r.depositDate), 7.3, { align: "center" }));
      ops.push(T((COLS[2] + COLS[3]) / 2, b, clip(r.invoices, COLS[3] - COLS[2], 7.3), 7.3, { align: "center" }));
      ops.push(T((COLS[3] + COLS[4]) / 2, b, dmyFull(r.invDate), 7.3, { align: "center" }));
      ops.push(T(COLS[5] - 4, b, inFmt(r.billAmt), 7.3, { align: "right" }));
      ops.push(T((COLS[5] + COLS[6]) / 2, b, `${Number(r.pct) || 0}%`, 7.3, { align: "center" }));
      if (r.cd) ops.push(T(COLS[7] - 4, b, inFmt(r.cd), 7.3, { align: "right" })); else ops.push(T((COLS[6] + COLS[7]) / 2, b, "-", 7.3, { align: "center" }));
      if (r.gr) ops.push(T(COLS[8] - 4, b, inFmt(r.gr), 7.3, { align: "right" }));
      if (r.freight) ops.push(T(COLS[9] - 4, b, inFmt(r.freight), 7.3, { align: "right" }));
      ops.push(T(COLS[10] - 4, b, inFmt(r.amount), 7.3, { align: "right" }));
      ops.push(T((COLS[10] + COLS[11]) / 2, b, clip(r.ref, COLS[11] - COLS[10], 7.3), 7.3, { align: "center" }));
      ops.push(T((COLS[11] + COLS[12]) / 2, b, r.mode || "", 7.3, { align: "center" }));
      ops.push(L(COLS[0], y + ROW_H, COLS[12], y + ROW_H, 0.5));
      void c;
    });
    const bodyBottom = hb + chunk.length * ROW_H;
    // vertical dividers for header + body
    COLS.forEach((x) => ops.push(L(x, top, x, bodyBottom + (isLast ? ROW_H : 0), 0.6)));

    if (isLast) {
      const tt = adviceTotals(rows);
      const y = bodyBottom;
      const b = y + 8.9;
      ops.push(T(COLS[0] + 2, b, "Total", 8.2, { bold: true }));
      ops.push(T(COLS[5] - 4, b, inFmt(tt.bill), 8.2, { bold: true, align: "right" }));
      ops.push(T(COLS[7] - 4, b, inFmt(tt.cd), 8.2, { bold: true, align: "right" }));
      ops.push(T(COLS[8] - 4, b, inFmt(tt.gr), 8.2, { bold: true, align: "right" }));
      ops.push(T(COLS[9] - 12, b, tt.freight ? inFmt(tt.freight) : "-", 8.2, { bold: true, align: "right" }));
      ops.push(T(COLS[10] - 4, b, inFmt(tt.amount), 8.2, { bold: true, align: "right" }));
      const tb = y + ROW_H;
      ops.push(L(COLS[0], tb, COLS[12], tb, 1.6));
      ops.push(T(COLS[0] + 2, tb + 11, "Total Amount in Words :", 8.2));
      ops.push(T(136.4, tb + 11, inWords(tt.amount), 8.2, { bold: true }));
      const wb = tb + 15;
      ops.push(L(COLS[0], wb, COLS[12], wb, 1.6));
      ops.push(L(COLS[0], tb, COLS[0], wb, 0.6));
      ops.push(L(COLS[12], tb, COLS[12], wb, 0.6));
      ops.push(T(830, wb + 22, P.forLine, 9, { bold: true, align: "right" }));
      ops.push(T(3.4, wb + 38, P.note, 8.6));
    } else {
      ops.push(L(COLS[0], bodyBottom, COLS[12], bodyBottom, 0.8));
    }
    return ops;
  });
}

export async function advicePdfBlob(pages) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: [PW, PH], orientation: "landscape" });
  pages.forEach((ops, i) => {
    if (i) doc.addPage([PW, PH], "landscape");
    ops.forEach((op) => {
      if (op.t === "rect") {
        doc.setLineWidth(op.lw || 1);
        doc.setDrawColor(...(op.stroke || [0, 0, 0]));
        if (op.fill) { doc.setFillColor(...op.fill); doc.rect(op.x, op.y, op.w, op.h, "FD"); } else doc.rect(op.x, op.y, op.w, op.h, "S");
      } else if (op.t === "line") {
        doc.setLineWidth(op.lw || 1);
        doc.setDrawColor(0, 0, 0);
        doc.line(op.x1, op.y1, op.x2, op.y2);
      } else {
        doc.setFont("helvetica", op.bold ? "bold" : "normal");
        doc.setFontSize(op.size);
        doc.setTextColor(0, 0, 0);
        doc.text(op.s, op.x, op.y, { align: op.align || "left" });
      }
    });
  });
  return doc.output("blob");
}

export function adviceCanvas(ops, scale = 1.6) {
  const low = Math.max(...ops.map((o) => (o.t === "text" ? o.y + 6 : o.t === "line" ? Math.max(o.y1, o.y2) : o.t === "rect" ? o.y + o.h : 0)));
  const H = Math.min(PH, Math.ceil(low + 24));
  const c = document.createElement("canvas");
  c.width = PW * scale;
  c.height = H * scale;
  const ctx = c.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, PW, H);
  ops.forEach((op) => {
    if (op.t === "rect") {
      if (op.fill) { ctx.fillStyle = `rgb(${op.fill.join(",")})`; ctx.fillRect(op.x, op.y, op.w, op.h); }
      ctx.lineWidth = op.lw || 1; ctx.strokeStyle = "#000"; ctx.strokeRect(op.x, op.y, op.w, op.h);
    } else if (op.t === "line") {
      ctx.lineWidth = op.lw || 1; ctx.strokeStyle = "#000";
      ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke();
    } else {
      ctx.font = `${op.bold ? "bold " : ""}${op.size}px Arial, Helvetica, sans-serif`;
      ctx.fillStyle = "#000"; ctx.textAlign = op.align || "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText(op.s, op.x, op.y);
    }
  });
  return c;
}
