// claimReportXlsx.js — simple Excel table of claims / differences (shareable with the mill).
// Sheet 1 "Claims Detail": one row per entry, filter on, total row.  Sheet 2 "Summary": count + amount by claim type.

import * as XLSX from "xlsx";
import { DIFF_TYPES } from "./outstanding";

const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const toDate = (iso) => (iso ? new Date(`${iso}T12:00:00Z`) : "");
const r2 = (n) => Math.round(n * 100) / 100;

export function buildClaimWorkbook({ items, bills = [], includeClosed = true }) {
  const lookup = (party, billNo) => {
    const rk = norm(billNo);
    return rk ? bills.find((b) => norm(b.party) === norm(party) && norm(b.billNo) === rk) || null : null;
  };
  const list = (items || [])
    .filter((d) => includeClosed || d.status !== "closed")
    .sort((a, b) => a.party.localeCompare(b.party) || String(a.billNo).localeCompare(String(b.billNo)));

  // ---------- Claims Detail ----------
  const head = ["S.No", "Party", "Bill No", "Bill Date", "Claim Type", "Claim Ref", "Bill Amount", "Claim Amount", "Status", "Marked On", "Remarks"];
  const rows = list.map((d, i) => {
    const b = lookup(d.party, d.billNo);
    return [i + 1, d.party, d.billNo || "", b ? toDate(b.date) : "", d.type, d.ref || "", b && b.amount > 0 ? b.amount : "", Number(d.amount) || 0, d.status === "closed" ? "Closed" : "Open", toDate(d.date), d.note || ""];
  });
  const ws = XLSX.utils.aoa_to_sheet([head, ...rows], { cellDates: true });
  const n = rows.length;
  const last = n + 1;
  for (let r = 2; r <= last; r++) {
    ["D", "J"].forEach((c) => { if (ws[`${c}${r}`]?.t === "d") ws[`${c}${r}`].z = "dd-mmm-yyyy"; });
    ["G", "H"].forEach((c) => { if (ws[`${c}${r}`]?.t === "n") ws[`${c}${r}`].z = "#,##0"; });
  }
  const openTotal = r2(list.filter((d) => d.status !== "closed").reduce((t, d) => t + (Number(d.amount) || 0), 0));
  const tr = last + 1;
  XLSX.utils.sheet_add_aoa(ws, [["", "Total (Open items)"]], { origin: `A${tr}` });
  ws[`H${tr}`] = n ? { t: "n", f: `SUMIF(I2:I${last},"Open",H2:H${last})`, v: openTotal, z: "#,##0" } : { t: "n", v: 0, z: "#,##0" };
  ws["!ref"] = `A1:K${tr}`;
  if (n) ws["!autofilter"] = { ref: `A1:K${last}` };
  ws["!cols"] = [6, 34, 14, 12, 18, 14, 14, 14, 9, 12, 44].map((w) => ({ wch: w }));

  // ---------- Summary (open items by claim type) ----------
  const open = list.filter((d) => d.status !== "closed");
  const types = [...DIFF_TYPES, ...new Set(open.map((d) => d.type).filter((t) => !DIFF_TYPES.includes(t)))];
  const srows = types.map((t) => {
    const li = open.filter((d) => d.type === t);
    return [t, li.length, r2(li.reduce((s, d) => s + (Number(d.amount) || 0), 0))];
  });
  const ss = XLSX.utils.aoa_to_sheet([["Claim Type", "No. of Items", "Claim Amount"], ...srows]);
  const sl = srows.length + 1;
  srows.forEach((row, i) => {
    const r = i + 2;
    if (n) {
      ss[`B${r}`] = { t: "n", f: `COUNTIFS('Claims Detail'!$E$2:$E$${last},A${r},'Claims Detail'!$I$2:$I$${last},"Open")`, v: row[1] };
      ss[`C${r}`] = { t: "n", f: `SUMIFS('Claims Detail'!$H$2:$H$${last},'Claims Detail'!$E$2:$E$${last},A${r},'Claims Detail'!$I$2:$I$${last},"Open")`, v: row[2], z: "#,##0" };
    } else ss[`C${r}`].z = "#,##0";
  });
  const st = sl + 1;
  XLSX.utils.sheet_add_aoa(ss, [["Total"]], { origin: `A${st}` });
  ss[`B${st}`] = { t: "n", f: `SUM(B2:B${sl})`, v: open.length };
  ss[`C${st}`] = { t: "n", f: `SUM(C2:C${sl})`, v: openTotal, z: "#,##0" };
  XLSX.utils.sheet_add_aoa(ss, [["Open items only."]], { origin: `A${st + 2}` });
  ss["!ref"] = `A1:C${st + 2}`;
  ss["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Claims Detail");
  XLSX.utils.book_append_sheet(wb, ss, "Summary");
  return wb;
}

export function downloadClaimExcel(opts, filename) {
  XLSX.writeFile(buildClaimWorkbook(opts), filename);
}
