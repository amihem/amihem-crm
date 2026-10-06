// statementImage.js — draws a customer-facing outstanding statement on a
// canvas (company header, totals, ageing bar, bill-wise ageing bars) and
// turns it into PNG / PDF for WhatsApp. Canvas-only: no extra packages.

import { getCompanyName } from "../services/companyProfile";
import { buildWhatsAppLink } from "../services/whatsapp";
import { formatCurrency, downloadBlob } from "./helpers";
import { BUCKETS, bucketOf, fmtDate, overdueAmount } from "./outstanding";

const W = 1080;
const SCALE = 2;
const NAVY = "#14213D";
const GRAY = "#6B7280";
const LINE = "#E5E7EB";
const GREEN = "#2F6E5D";
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif';
const rs = (n) => `₹${formatCurrency(n)}`;
const short = (iso) => fmtDate(iso).replace(/-(\d{2})(\d{2})$/, "-$2");

function rr(ctx, x, y, w, h, r, fill) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function T(ctx, s, x, y, { size = 24, weight = 400, color = "#111827", align = "left" } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
}
function wrap(ctx, text, maxW, size) {
  ctx.font = `400 ${size}px ${FONT}`;
  const out = [];
  String(text || "").split("\n").forEach((para) => {
    let line = "";
    para.split(/\s+/).filter(Boolean).forEach((w) => {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    });
    out.push(line);
  });
  return out.filter((l) => l !== "" || out.length > 1);
}

export function renderStatementCanvas(group, asOn, { creditDays = 60, footer = "", company = getCompanyName() } = {}) {
  const bills = [...group.bills].sort((a, b) => a.date.localeCompare(b.date));
  const n = bills.length;
  const maxAmt = Math.max(1, ...bills.map((b) => Math.abs(b.outstanding)));
  const overdue = overdueAmount(group, creditDays);
  const pending = bills.filter((b) => b.outstanding > 0).length;

  const m = document.createElement("canvas").getContext("2d");
  const fLines = footer ? wrap(m, footer, W - 96, 21) : [];

  const ROW = 76;
  const tableTop = 740;
  const totalTop = tableTop + n * ROW + 10;
  const footStart = totalTop + 84 + 40;
  const H = footStart + (fLines.length ? fLines.length * 32 + 20 : 0) + 70;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  // header
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, 140);
  T(ctx, company, 48, 64, { size: 40, weight: 700, color: "#fff" });
  T(ctx, "OUTSTANDING STATEMENT", 48, 106, { size: 21, weight: 600, color: "#AEB8CC" });
  T(ctx, "As on", W - 48, 62, { size: 20, color: "#AEB8CC", align: "right" });
  T(ctx, fmtDate(asOn), W - 48, 104, { size: 34, weight: 700, color: "#fff", align: "right" });

  // party
  T(ctx, group.name, 48, 206, { size: 44, weight: 700, color: NAVY });
  T(ctx, `${pending} pending bill${pending === 1 ? "" : "s"}${group.oldest ? ` · Oldest ${group.oldest} days` : ""}`, 48, 246, { size: 24, color: GRAY });

  // summary cards
  const cw = (W - 96 - 40) / 3;
  const cards = [
    { label: "NET OUTSTANDING", value: rs(group.total), bg: "#F3F4F6", fg: NAVY },
    { label: `OVERDUE (> ${creditDays} DAYS)`, value: rs(overdue), bg: overdue > 0 ? "#FDECEA" : "#E8F3EE", fg: overdue > 0 ? "#B4453A" : GREEN },
    group.advance > 0
      ? { label: "ADVANCE / CREDIT", value: rs(group.advance), bg: "#E8F3EE", fg: GREEN }
      : { label: "OLDEST BILL", value: `${group.oldest || 0} days`, bg: "#F3F4F6", fg: NAVY },
  ];
  cards.forEach((c, i) => {
    const x = 48 + i * (cw + 20);
    rr(ctx, x, 290, cw, 120, 16, c.bg);
    T(ctx, c.label, x + 22, 330, { size: 17, weight: 600, color: GRAY });
    T(ctx, c.value, x + 22, 383, { size: 36, weight: 700, color: c.fg });
  });

  // ageing summary
  T(ctx, "AGEING SUMMARY", 48, 462, { size: 20, weight: 700, color: GRAY });
  const bw = W - 96;
  rr(ctx, 48, 480, bw, 34, 17, "#EEF0F3");
  if (group.due > 0) {
    ctx.save();
    ctx.beginPath(); ctx.rect(48, 480, bw, 34); ctx.clip();
    let x = 48;
    BUCKETS.forEach((b) => {
      const v = group.buckets[b.key];
      if (v > 0) { const w = (v / group.due) * bw; ctx.fillStyle = b.color; ctx.fillRect(x, 480, w, 34); x += w; }
    });
    ctx.restore();
  }
  BUCKETS.forEach((b, i) => {
    const x = 48 + i * (bw / 5);
    ctx.beginPath(); ctx.arc(x + 7, 556, 7, 0, Math.PI * 2); ctx.fillStyle = b.color; ctx.fill();
    T(ctx, `${b.label} days`, x + 24, 562, { size: 20, color: GRAY });
    T(ctx, group.buckets[b.key] > 0 ? rs(group.buckets[b.key]) : "–", x, 603, { size: 26, weight: 700, color: group.buckets[b.key] > 0 ? "#111827" : "#9CA3AF" });
  });

  // bill-wise ageing
  T(ctx, "BILL-WISE AGEING", 48, 675, { size: 20, weight: 700, color: GRAY });
  const BX = 440, BW = 270, AMT = 905, CHIP = 930;
  T(ctx, "BILL", 48, 716, { size: 17, weight: 600, color: GRAY });
  T(ctx, "AMOUNT BY AGEING", BX, 716, { size: 17, weight: 600, color: GRAY });
  T(ctx, "OUTSTANDING", AMT, 716, { size: 17, weight: 600, color: GRAY, align: "right" });
  T(ctx, "DAYS", CHIP + 51, 716, { size: 17, weight: 600, color: GRAY, align: "center" });
  ctx.fillStyle = LINE; ctx.fillRect(48, 728, W - 96, 2);

  bills.forEach((b, i) => {
    const cy = tableTop + i * ROW + ROW / 2;
    const neg = b.outstanding < 0;
    const color = neg ? GREEN : bucketOf(b.days).color;
    T(ctx, neg ? (b.billNo && !/advance/i.test(b.billNo) ? `Credit · ${b.billNo}` : "Advance / Credit") : `Bill ${b.billNo}`, 48, cy - 4, { size: 26, weight: 700, color: NAVY });
    const sub = `${short(b.date)}${b.credit > 0 && b.amount > 0 ? ` · rcvd ${rs(b.credit)}` : ""}`;
    T(ctx, sub, 48, cy + 24, { size: 18, color: GRAY });
    rr(ctx, BX, cy - 11, BW, 22, 11, "#EEF0F3");
    rr(ctx, BX, cy - 11, Math.max(16, (Math.abs(b.outstanding) / maxAmt) * BW), 22, 11, color);
    T(ctx, `${neg ? "-" : ""}${rs(Math.abs(b.outstanding))}`, AMT, cy + 9, { size: 27, weight: 700, color: neg ? GREEN : "#111827", align: "right" });
    rr(ctx, CHIP, cy - 18, 102, 36, 18, `${color}26`);
    T(ctx, neg ? "Adv" : `${b.days}d`, CHIP + 51, cy + 8, { size: 21, weight: 700, color, align: "center" });
    if (i < n - 1) { ctx.fillStyle = LINE; ctx.fillRect(48, tableTop + (i + 1) * ROW, W - 96, 1); }
  });

  // total
  rr(ctx, 48, totalTop, W - 96, 84, 16, NAVY);
  T(ctx, "TOTAL OUTSTANDING", 76, totalTop + 52, { size: 24, weight: 700, color: "#fff" });
  T(ctx, rs(group.total), W - 76, totalTop + 55, { size: 38, weight: 700, color: "#fff", align: "right" });

  // footer
  fLines.forEach((l, i) => T(ctx, l, 48, footStart + i * 32, { size: 21, color: GRAY }));
  T(ctx, company, W / 2, H - 30, { size: 19, weight: 600, color: "#9CA3AF", align: "center" });
  return canvas;
}

export const canvasToBlob = (canvas, type = "image/png", q) =>
  new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Image failed"))), type, q));

// One page: A4 when the statement fits, otherwise a taller page of the same width.
export async function canvasToPdfBlob(canvas) {
  const { jsPDF } = await import("jspdf");
  const pw = 595.28;
  const ph = Math.max(841.89, (pw * canvas.height) / canvas.width);
  const pdf = new jsPDF({ unit: "pt", format: [pw, ph] });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, pw, (pw * canvas.height) / canvas.width);
  return pdf.output("blob");
}

export const statementCaption = (group, asOn, company = getCompanyName()) =>
  `Dear ${group.name},\nPlease find your outstanding statement as on ${fmtDate(asOn)}.\nNet outstanding: ${rs(group.total)}\n\nRegards\n${company}`;

export const statementFileName = (group, ext) => `Statement_${group.name.replace(/\W+/g, "_")}.${ext}`;

// Phone: native share sheet (pick WhatsApp, file attached). Desktop: file is
// downloaded and the customer's chat opens so it can be attached.
export async function shareStatementFile(blob, filename, phone, text) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: filename });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  downloadBlob(filename, blob);
  if (phone) window.open(buildWhatsAppLink(phone, text), "_blank");
  return "downloaded";
}
export { downloadBlob };
