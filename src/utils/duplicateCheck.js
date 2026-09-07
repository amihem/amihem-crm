// duplicateCheck.js — catches near-duplicate records before they split a
// customer's history into two separate cards, or two tickets end up
// sharing the same ticket number. Same reasoning as trdsls-app's
// findDuplicateCustomer/warnIfDuplicateBillNo — normalize and compare,
// then let the person decide rather than silently blocking or silently
// allowing.

function normName(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Finds an existing customer whose normalized name matches (catches
// duplicates from extra spaces, different casing, etc.)
export function findDuplicateCustomer(name, customers, excludeId) {
  const n = normName(name);
  if (!n) return null;
  return (customers || []).find((c) => c.id !== excludeId && normName(c.name) === n) || null;
}

export function findDuplicateTicketNumber(ticketNumber, tickets, excludeId) {
  const n = String(ticketNumber || "").trim().toLowerCase();
  if (!n) return null;
  return (tickets || []).find((t) => t.id !== excludeId && String(t.ticketNumber || "").trim().toLowerCase() === n) || null;
}
