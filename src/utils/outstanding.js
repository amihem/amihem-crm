// outstanding.js — parsing, ageing, customer matching and WhatsApp
// statement building for the Outstanding module. Pure functions + a few
// localStorage helpers; no dependency on the dataService stores.
//
// Data is a point-in-time snapshot (each upload replaces the previous
// one), so it lives in localStorage like companyProfile.js does.

import * as XLSX from "xlsx";
import { getCompanyName } from "../services/companyProfile";
import { formatCurrency } from "./helpers";

// ---------- ageing buckets ----------
export const BUCKETS = [
  { key: "b0", label: "0–30", min: 0, max: 30, color: "#2F6E5D" },
  { key: "b1", label: "31–60", min: 31, max: 60, color: "#7A9A4E" },
  { key: "b2", label: "61–90", min: 61, max: 90, color: "#C9862D" },
  { key: "b3", label: "91–120", min: 91, max: 120, color: "#C4623A" },
  { key: "b4", label: "120+", min: 121, max: Infinity, color: "#B4453A" },
];

export function bucketOf(days) {
  const d = Math.max(0, Number(days) || 0);
  return BUCKETS.find((b) => d >= b.min && d <= b.max) || BUCKETS[BUCKETS.length - 1];
}

// ---------- localStorage ----------
const K_SNAP = "amihem_crm_outstanding_snapshot";
const K_LINKS = "amihem_crm_outstanding_links";
const K_SENT = "amihem_crm_outstanding_sent";
const K_SET = "amihem_crm_outstanding_settings";

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Navkar keeps the original keys (so existing data survives); other
// sources get a suffix.
const kk = (base, source) => (!source || source === "navkar" ? base : `${base}__${source}`);
export const loadSnapshot = (source) => read(kk(K_SNAP, source), null);
export const saveSnapshot = (s, source) => write(kk(K_SNAP, source), s);
export const loadLinks = (source) => read(kk(K_LINKS, source), {});
export const saveLinks = (l, source) => write(kk(K_LINKS, source), l);
export const loadSent = (source) => read(kk(K_SENT, source), {});
export const saveSent = (s, source) => write(kk(K_SENT, source), s);
export const DEFAULT_FOOTER = "Kindly arrange the payment at the earliest. Please ignore if already paid.";
export const loadSettings = (source) => ({ creditDays: 60, footer: DEFAULT_FOOTER, ...read(kk(K_SET, source), {}) });
export const saveSettings = (s, source) => write(kk(K_SET, source), s);

// ---------- sources (one outstanding report per company ledger) ----------
export const SOURCES = [
  { id: "navkar", label: "Navkar Fabrics", accept: ".xlsx,.xls,.csv,.pdf", hint: "Party Wise Outstanding — Excel / CSV / PDF with Bill Date, Bill No, Bill Amount, Credit Amount, Outstanding, Ageing Days." },
  { id: "ranjan", label: "Ranjan Fabrics", accept: ".pdf,.xlsx,.xls,.csv", hint: "Agent Outstanding With Party Eject report (PDF or Excel) from Ranjan Fabrics Pvt. Ltd." },
];
const titleCase = (t) => (t === t.toUpperCase() ? t.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : t);
export function companyFor(source, snap) {
  if (source === "ranjan") return titleCase(snap?.company || "Ranjan Fabrics Pvt. Ltd.");
  return getCompanyName();
}

// ---------- dates ----------
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(isoStr) {
  if (!isoStr) return "—";
  const [y, m, d] = isoStr.split("-").map(Number);
  return `${pad(d)}-${MONTHS[m - 1]}-${y}`;
}

function utc(isoStr) {
  const [y, m, d] = isoStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
export const diffDays = (laterIso, earlierIso) => Math.round((utc(laterIso) - utc(earlierIso)) / 864e5);
const todayIso = () => {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth() + 1, t.getDate());
};

// Handles real Date cells, Excel serials, and text like 1/23/2026,
// 23-01-2026, 2026-01-23. For ambiguous text (both d/m and m/d valid)
// the file's own Ageing Days is used to pick the right reading.
function toIsoDate(v, asOn, ageing) {
  if (v instanceof Date) {
    const x = new Date(v.getTime() + 12 * 36e5);
    return iso(x.getFullYear(), x.getMonth() + 1, x.getDate());
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? iso(d.y, d.m, d.d) : null;
  }
  const m = String(v).trim().match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/);
  if (!m) return null;
  const [a, b, c] = [+m[1], +m[2], +m[3]];
  if (a > 31) return iso(a, b, c); // y-m-d
  const y = c < 100 ? c + 2000 : c;
  const ok = (mo, d) => mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
  const cands = [];
  if (ok(b, a)) cands.push([y, b, a]); // d/m/y
  if (a !== b && ok(a, b)) cands.push([y, a, b]); // m/d/y
  if (!cands.length) return null;
  if (cands.length > 1 && ageing != null && asOn) {
    const hit = cands.find(([yy, mm, dd]) => diffDays(asOn, iso(yy, mm, dd)) === ageing);
    if (hit) return iso(...hit);
  }
  return iso(...cands[0]);
}

function toNum(v) {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[₹,\s]/g, "");
  if (!s || s === "-") return null;
  const n = Number(s.replace(/^\((.*)\)$/, "-$1"));
  return isNaN(n) ? null : n;
}

// ---------- parsing ----------
// Understands the "Party Wise Outstanding" layout (a "Party : NAME" row,
// then bill rows, then "Party Total") and also a flat table that has a
// Party column. Columns are located from the header row when present.
export function parseRows(rows, fileName = "") {
  let asOn = null;
  let party = null;
  let partyCol = -1;
  let cols = { date: 0, billNo: 1, amount: 2, credit: 3, outstanding: 4, ageing: 5 };
  const raw = [];

  for (const row of rows) {
    const cells = row.map((c) => (typeof c === "string" ? c.trim() : c));
    const joined = cells.filter((c) => typeof c === "string" && c).join(" ");

    const mAsOn = joined.match(/as\s+on\s*:?\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/i);
    if (mAsOn && !asOn) {
      const y = +mAsOn[3] < 100 ? +mAsOn[3] + 2000 : +mAsOn[3];
      asOn = iso(y, +mAsOn[2], +mAsOn[1]); // dd-mm-yyyy
    }

    if (/bill\s*date/i.test(joined) && /outstanding/i.test(joined)) {
      const map = {};
      cells.forEach((c, i) => {
        const t = String(c).toLowerCase();
        if (!t) return;
        if (/bill\s*date|^date$/.test(t)) map.date = i;
        else if (/bill\s*no|invoice|voucher/.test(t)) map.billNo = i;
        else if (/bill\s*amount|^amount$/.test(t)) map.amount = i;
        else if (/credit/.test(t)) map.credit = i;
        else if (/outstanding|balance|pending/.test(t)) map.outstanding = i;
        else if (/ageing|aging|days/.test(t)) map.ageing = i;
        else if (/^party/.test(t)) partyCol = i;
      });
      cols = { ...cols, ...map };
      continue;
    }

    const pi = cells.findIndex((c) => typeof c === "string" && /^party\s*:/i.test(c));
    if (pi >= 0) {
      let name = cells[pi].replace(/^party\s*:\s*/i, "").trim();
      if (!name) name = String(cells.slice(pi + 1).find((c) => c !== "" && c != null) || "").trim();
      party = name;
      continue;
    }
    if (/party\s*total|grand\s*total/i.test(joined)) continue;

    let p = party;
    if (partyCol >= 0) {
      const cell = String(cells[partyCol] ?? "").trim();
      if (cell) party = p = cell;
    }
    if (!p) continue;
    const d0 = cells[cols.date];
    if (d0 === "" || d0 == null) continue;
    const outstanding = toNum(cells[cols.outstanding]);
    if (outstanding == null) continue;
    raw.push({
      party: p,
      dateRaw: d0,
      billNo: String(cells[cols.billNo] ?? "").trim(),
      amount: toNum(cells[cols.amount]) || 0,
      credit: toNum(cells[cols.credit]) || 0,
      outstanding,
      ageing: cols.ageing != null ? toNum(cells[cols.ageing]) : null,
    });
  }

  asOn = asOn || todayIso();
  const bills = [];
  let skipped = 0;
  for (const r of raw) {
    const date = toIsoDate(r.dateRaw, asOn, r.ageing);
    if (!date) { skipped++; continue; }
    bills.push({
      party: r.party,
      date,
      billNo: r.billNo,
      amount: r.amount,
      credit: r.credit,
      outstanding: r.outstanding,
      days: r.ageing != null ? r.ageing : Math.max(0, diffDays(asOn, date)),
    });
  }
  if (!bills.length) {
    throw new Error("No bills found. Expected columns: Bill Date, Bill No, Bill Amount, Credit Amount, Outstanding, Ageing Days.");
  }
  return { asOn, fileName, uploadedAt: new Date().toISOString(), bills, skipped };
}

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const NUM = /^-?\d+(\.\d+)?$/;

// "Agent Outstanding With Party Eject" layout (Ranjan Fabrics). Works on text
// lines, so the same code reads the PDF and an Excel/CSV export of it.
// Per bill row: Bill No, Date, [Due Days], Debit, Credit, Balance, Late Days, Run Balance.
// Balance = outstanding, Late Days = ageing.
export function parseRanjanLines(lines, fileName = "") {
  let asOn = null;
  let company = null;
  let party = null;
  const bills = [];
  let skipped = 0;

  for (const raw of lines) {
    const line = String(raw).replace(/\s+/g, " ").trim();
    if (!line) continue;

    const mUp = line.match(/UP-?TO\s+(\d{1,2})\/([A-Za-z]{3})[A-Za-z]*\/(\d{4})/i);
    if (mUp && !asOn) {
      const mo = MON[mUp[2].toLowerCase()];
      if (mo) asOn = iso(+mUp[3], mo, +mUp[1]);
    }
    if (!company && /\b(PVT|LTD|LIMITED|LLP)\b/i.test(line) && !/^party\b/i.test(line) && !/^agent\b/i.test(line)) company = line.replace(/\s*\|.*$/, "").trim();

    if (/^party total|^ledger balance|^agent ?total|^agent\b|^bill no\.?|^page \d|outs?anding with party|^from \d|^days\b|^debit\b/i.test(line)) continue;
    if (/^\d{1,2}\/[A-Za-z]{3}\/\d{4}\b/.test(line)) continue; // print date/time stamp

    const mp = line.match(/^party\s+(.+)$/i);
    if (mp) {
      const rest = mp[1];
      const comma = rest.indexOf(",");
      party = (comma > 0 ? rest.slice(0, comma) : rest.replace(/\s*Ph\.?:.*$/i, "")).trim();
      continue;
    }

    const mb = line.match(/^(\S+)\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(.*)$/);
    if (!mb || !party) continue;
    const t = mb[5].split(" ").filter(Boolean);
    if (t.length < 3 || !t.every((x) => NUM.test(x))) { skipped++; continue; }
    const balance = Number(t[t.length - 3]);
    const days = Math.max(0, Math.round(Number(t[t.length - 2])));
    let rem = t.slice(0, -3);
    if (rem.length > 2 || (rem.length === 2 && rem.some((x) => !x.includes(".")) && rem.some((x) => x.includes(".")))) {
      const dec = rem.filter((x) => x.includes("."));
      if (dec.length) rem = dec;
    }
    let debit = 0;
    let credit = 0;
    if (rem.length >= 2) { debit = Number(rem[0]); credit = Number(rem[1]); }
    else if (rem.length === 1) { if (balance < 0) credit = Number(rem[0]); else debit = Number(rem[0]); }
    if (!balance) continue;
    const y = +mb[4] < 100 ? +mb[4] + 2000 : +mb[4];
    bills.push({ party, date: iso(y, +mb[3], +mb[2]), billNo: mb[1], amount: debit, credit, outstanding: balance, days });
  }

  if (!bills.length) {
    throw new Error("No bills found. Expected the “Agent Outstanding With Party Eject” report (Party / Bill No / Date / Debit / Credit / Balance / Late Days).");
  }
  return { asOn: asOn || todayIso(), company, fileName, uploadedAt: new Date().toISOString(), bills, skipped };
}

// Excel/CSV rows -> one text line per row (dates written dd/mm/yy)
function rowsToLines(rows) {
  return rows.map((r) =>
    r.map((c) => {
      if (c instanceof Date) { const x = new Date(c.getTime() + 12 * 36e5); return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${String(x.getFullYear()).slice(2)}`; }
      return c === "" || c == null ? "" : String(c).trim();
    }).filter(Boolean).join(" ")
  );
}

export async function parseOutstandingFile(file, source = "navkar") {
  const buf = await file.arrayBuffer();
  const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  let lines;
  let rows;
  if (isPdf) {
    const { pdfToLines } = await import("./pdfLines");
    lines = await pdfToLines(buf);
  } else {
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    lines = rowsToLines(rows);
  }
  if (source === "ranjan") return parseRanjanLines(lines, file.name);
  if (isPdf) {
    // Party-wise PDF: one row per text line; the header line is skipped (default column order applies)
    rows = lines
      .filter((l) => !(/bill\s*date/i.test(l) && /outstanding/i.test(l)))
      .map((l) => (/^party\s*:/i.test(l) ? [l] : l.split(/\s+/)));
  }
  return parseRows(rows, file.name);
}

// ---------- grouping ----------
const STOP = new Set(["PVT", "LTD", "LLP", "PRIVATE", "LIMITED", "CO", "AND", "THE", "M", "S", "MS"]);
export function normName(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/\([^)]*\)/g, " ") // agent tags like "(RAJEEV)" are not part of the name
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join(" ");
}

export function groupParties(bills) {
  const map = new Map();
  for (const b of bills) {
    if (!map.has(b.party)) {
      map.set(b.party, {
        key: normName(b.party) || b.party,
        name: b.party,
        bills: [],
        total: 0,
        due: 0, // positive bills only
        advance: 0, // credit balances, as a positive number
        buckets: Object.fromEntries(BUCKETS.map((k) => [k.key, 0])),
        oldest: 0,
      });
    }
    const g = map.get(b.party);
    g.bills.push(b);
    g.total += b.outstanding;
    if (b.outstanding > 0) {
      g.due += b.outstanding;
      g.buckets[bucketOf(b.days).key] += b.outstanding;
      g.oldest = Math.max(g.oldest, b.days);
    } else {
      g.advance += -b.outstanding;
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const overdueAmount = (g, creditDays) =>
  g.bills.reduce((s, b) => (b.outstanding > 0 && b.days > creditDays ? s + b.outstanding : s), 0);

// ---------- customer matching ----------
const tokens = (s) => new Set(s.split(" ").filter(Boolean));
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((t) => b.has(t) && inter++);
  return inter / (a.size + b.size - inter);
}

// status: "auto" (safe to send) | "suggested" (needs a human tap) | "none"
export function matchParty(group, customers, links) {
  const link = links[group.key];
  if (link?.customerId) {
    const c = customers.find((x) => x.id === link.customerId);
    if (c) return { status: "auto", customer: c, linked: true };
  }
  const n = group.key;
  const compact = n.replace(/ /g, "");
  const exact =
    customers.find((c) => normName(c.name) === n) ||
    customers.find((c) => normName(c.name).replace(/ /g, "") === compact);
  if (exact) return { status: "auto", customer: exact };

  let best = null;
  let score = 0;
  const nt = tokens(n);
  for (const c of customers) {
    const cn = normName(c.name);
    if (!cn) continue;
    const cc = cn.replace(/ /g, "");
    let s = jaccard(nt, tokens(cn));
    if (compact.length >= 6 && cc.length >= 6 && (compact.includes(cc) || cc.includes(compact))) s = Math.max(s, 0.8);
    if (s > score) { score = s; best = c; }
  }
  if (best && score >= 0.5) return { status: "suggested", customer: best, score };
  return { status: "none" };
}

export const resolvePhone = (match, link) => link?.phone || match.customer?.phone || "";

// ---------- WhatsApp message ----------
const rs = (n) => `₹${formatCurrency(n)}`;

export function buildStatementMessage(group, asOn, opts = {}) {
  const { creditDays = 60, onlyOverdue = false, showAgeing = false, footer = DEFAULT_FOOTER, company = getCompanyName() } = opts;
  let bills = group.bills.filter((b) => b.outstanding > 0);
  if (onlyOverdue) bills = bills.filter((b) => b.days > creditDays);
  bills = [...bills].sort((a, b) => a.date.localeCompare(b.date));
  const total = bills.reduce((s, b) => s + b.outstanding, 0);

  const lines = bills.map(
    (b, i) => `${i + 1}. Bill *${b.billNo}* | ${fmtDate(b.date)} | ${rs(b.outstanding)} | ${b.days} days`
  );

  const out = [company, "", `Dear *${group.name}*,`, "", onlyOverdue
    ? `Following bills are overdue (beyond ${creditDays} days) as on *${fmtDate(asOn)}*:`
    : `Outstanding statement as on *${fmtDate(asOn)}*:`, "", ...lines, ""];

  if (!onlyOverdue && group.advance > 0) {
    out.push(`Less: Advance / Credit ${rs(group.advance)}`);
    out.push(`*Net Outstanding: ${rs(total - group.advance)}*`);
  } else {
    out.push(`*Total ${onlyOverdue ? "Overdue" : "Outstanding"}: ${rs(total)}*`);
  }

  if (showAgeing && !onlyOverdue) {
    const parts = BUCKETS.filter((k) => group.buckets[k.key] > 0).map((k) => `${k.label} days: ${rs(group.buckets[k.key])}`);
    if (parts.length) out.push("", "Ageing:", ...parts);
  }
  if (footer) out.push("", footer);
  out.push("", "Regards", company);
  return out.join("\n");
}

// ---------- export ----------
export function exportExcel(filename, sheetName, rows, columns) {
  const aoa = [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => r[c.key] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.label.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

// ---------- compact INR (₹75.71L / ₹1.20Cr) for dense mobile views ----------
export function compactINR(n, symbol = true) {
  const v = Math.abs(Number(n) || 0);
  const sign = n < 0 ? "-" : "";
  const c = symbol ? "₹" : "";
  if (v >= 1e7) return `${sign}${c}${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${sign}${c}${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${sign}${c}${(v / 1e3).toFixed(1)}K`;
  return `${sign}${c}${Math.round(v)}`;
}

// Owner-side summary (to share/copy), not for customers.
export function summaryMessage(rows, totals, asOn, creditDays, company = getCompanyName()) {
  const top = rows.filter((r) => r.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 10);
  const L = [
    `*${company} — Outstanding Summary*`, `As on ${fmtDate(asOn)}`, "",
    `Net outstanding: ${rs(totals.net)}`, `Overdue (> ${creditDays}d): ${rs(totals.overdue)}`, "",
    "*Ageing*", ...BUCKETS.map((b) => `${b.label} days: ${rs(totals.buckets[b.key])}`),
  ];
  if (top.length) L.push("", "*Top overdue*", ...top.map((r, i) => `${i + 1}. ${r.g.name} — ${rs(r.overdue)}`));
  return L.join("\n");
}
