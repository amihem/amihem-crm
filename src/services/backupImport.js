// backupImport.js — JSON backup/restore + Excel/CSV master import.
// Goes through the same dataService abstraction as everything else.

import * as XLSX from "xlsx";
import * as dataService from "./dataService";
import { STORES } from "./dataService";

export async function exportBackup() {
  const data = {};
  for (const store of Object.values(STORES)) {
    data[store] = await dataService.getAll(store);
  }
  const payload = {
    app: "amihem-crm",
    exportedAt: new Date().toISOString(),
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `amihem-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function restoreBackup(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed?.data) throw new Error("This doesn't look like an Amihem CRM backup file.");

  for (const store of Object.values(STORES)) {
    const records = parsed.data[store];
    if (Array.isArray(records) && records.length) {
      await dataService.bulkPut(store, records);
    }
  }
  return parsed;
}

// Every store as one multi-sheet .xlsx workbook — handy for opening in
// Excel directly, unlike the JSON backup which is for restoring in-app.
export async function exportAllToExcel() {
  const workbook = XLSX.utils.book_new();
  let hasAnySheet = false;
  for (const store of Object.values(STORES)) {
    const records = await dataService.getAll(store);
    if (records.length === 0) continue;
    const sheet = XLSX.utils.json_to_sheet(records);
    XLSX.utils.book_append_sheet(workbook, sheet, store.slice(0, 31)); // sheet name limit
    hasAnySheet = true;
  }
  if (!hasAnySheet) throw new Error("No data yet to export.");
  XLSX.writeFile(workbook, `amihem-crm-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Shares the JSON backup through the device share sheet (WhatsApp, Drive,
// email, etc.) where supported; otherwise falls back to a plain download.
export async function shareBackup() {
  const data = {};
  for (const store of Object.values(STORES)) {
    data[store] = await dataService.getAll(store);
  }
  const payload = { app: "amihem-crm", exportedAt: new Date().toISOString(), data };
  const filename = `amihem-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const file = new File([blob], filename, { type: "application/json" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch {
      // person cancelled — fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

// Parses an .xlsx/.csv file into an array of row objects keyed by header.
export function parseSpreadsheet(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// Maps arbitrary spreadsheet column headers (case-insensitive, flexible)
// onto our schema fields. Returns { imported, skipped }.
const CUSTOMER_COLUMN_MAP = {
  name: ["name", "customer name", "customer"],
  company: ["company"],
  city: ["city"],
  state: ["state"],
  buyerName: ["buyer", "buyer name"],
  phone: ["phone", "mobile", "contact"],
  whatsapp: ["whatsapp"],
  email: ["email"],
  category: ["category"],
  status: ["status"],
  preferredFabric: ["preferred fabric", "fabric"],
  creditDays: ["credit days", "credit"],
  remarks: ["remarks", "notes"],
};

const PRODUCT_COLUMN_MAP = {
  qualityName: ["quality name", "quality", "product"],
  category: ["category"],
  construction: ["construction"],
  composition: ["composition"],
  gsm: ["gsm"],
  width: ["width"],
  millName: ["mill", "mill name"],
  colour: ["colour", "color"],
  moq: ["moq"],
  price: ["price"],
  remarks: ["remarks", "notes"],
};

function mapRow(row, columnMap) {
  const lowerRow = {};
  Object.entries(row).forEach(([k, v]) => { lowerRow[k.trim().toLowerCase()] = v; });

  const mapped = {};
  for (const [field, aliases] of Object.entries(columnMap)) {
    for (const alias of aliases) {
      if (lowerRow[alias] !== undefined && lowerRow[alias] !== "") {
        mapped[field] = String(lowerRow[alias]);
        break;
      }
    }
  }
  return mapped;
}

export function mapCustomerRows(rows) {
  return rows.map((r) => mapRow(r, CUSTOMER_COLUMN_MAP)).filter((r) => r.name);
}

export function mapProductRows(rows) {
  return rows.map((r) => mapRow(r, PRODUCT_COLUMN_MAP)).filter((r) => r.qualityName);
}
