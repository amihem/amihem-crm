// companyProfile.js — business name shown in WhatsApp message headers.
// Kept in localStorage (not the synced dataService stores) since it's a
// single cosmetic value, not a record type — no need for IndexedDB/
// Supabase plumbing just for one string.

const KEY = "amihem_crm_company_name";
const DEFAULT_NAME = "Navkar Fabrics";

export function getCompanyName() {
  try {
    return localStorage.getItem(KEY) || DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
}

export function setCompanyName(name) {
  try {
    localStorage.setItem(KEY, name || DEFAULT_NAME);
  } catch {
    // localStorage unavailable — silently ignore, falls back to default
  }
}
