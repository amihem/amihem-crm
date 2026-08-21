// whatsapp.js — builds wa.me deep links with pre-filled templates.
// No API/business account needed; this just opens WhatsApp with text ready.
//
// Message style matches the Enquiry-follow-up format already proven in
// trdsls-app: bold business header, "Dear *Party Name*," opening, a bold
// description line, date fields, and a "Kindly revert at the earliest"
// closing with a Regards sign-off.

import { getCompanyName } from "./companyProfile";

function header() {
  return `🏢 *${getCompanyName()}*`;
}

function signOff() {
  return `Regards\n${getCompanyName()}`;
}

// DD/M/YYYY — matches the reference format, not the "31 Jul 2026" style
// used elsewhere in the app's UI.
function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function partyName(c) {
  return c.name || c.buyerName || "";
}

// Product name leads the description line (what the customer actually
// recognizes) — ticket number is still included as a small reference tag,
// not the headline, since a bare "AMH-2026-0003" means nothing to them.
function productLine(t) {
  const product = t.productName || "Sample";
  return `${product}${t.shade ? ` — ${t.shade}` : ""}`;
}

const TEMPLATES = {
  sampleReminder: (c, t) =>
    `${header()}\n\nDear *${partyName(c)}*,\n\nThis is a follow-up regarding:\n\n📋 *${productLine(t)}*\n(Ref: ${t.ticketNumber})\n\nSample Date: ${shortDate(t.date)}${t.dispatchDate ? `\nDispatch Date: ${shortDate(t.dispatchDate)}` : ""}\n\nKindly revert at the earliest.\n\n${signOff()}`,

  sampleReminderMulti: (c, tickets) => {
    const lines = tickets.map((t, i) => `${i + 1}. *${productLine(t)}* (Ref: ${t.ticketNumber})`).join("\n");
    return `${header()}\n\nDear *${partyName(c)}*,\n\nThis is a follow-up regarding the samples sent to you:\n\n${lines}\n\nKindly revert at the earliest.\n\n${signOff()}`;
  },

  priceReminder: (c, t) =>
    `${header()}\n\nDear *${partyName(c)}*,\n\nThis is a follow-up regarding:\n\n📋 *${productLine(t)}*\n(Ref: ${t.ticketNumber})\n\nWe had discussed pricing on this — kindly let us know if you'd like to move ahead.\n\nKindly revert at the earliest.\n\n${signOff()}`,

  orderReminder: (c, t) =>
    `${header()}\n\nDear *${partyName(c)}*,\n\nThis is a follow-up regarding:\n\n📋 *${productLine(t)}*\n(Ref: ${t.ticketNumber})\n\nKindly confirm if the order can be finalised from your end.\n\nKindly revert at the earliest.\n\n${signOff()}`,

  meetingReminder: (c) =>
    `${header()}\n\nDear *${partyName(c)}*,\n\nWould you have some time this week for a quick meeting to go over our new qualities?\n\nKindly revert at the earliest.\n\n${signOff()}`,

  thankYou: (c) =>
    `${header()}\n\nDear *${partyName(c)}*,\n\nThank you for your time today — always a pleasure. We'll follow up as discussed.\n\n${signOff()}`,

  greeting: (c) =>
    `${header()}\n\nDear *${partyName(c)}*,\n\nHope you're doing well! Just checking in from our side.\n\n${signOff()}`,
};

// Always normalizes to the LAST 10 digits + country code 91 — robust
// against however the number was originally entered (with/without +91,
// spaces, dashes, a leading 0, etc.).
export function buildWhatsAppLink(phone, message) {
  const digits = String(phone || "").replace(/\D/g, "");
  const withCountry = digits ? `91${digits.slice(-10)}` : "";
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export function getTemplateMessage(templateKey, customer, ticket) {
  const fn = TEMPLATES[templateKey];
  return fn ? fn(customer, ticket) : "";
}

export function getMultiSampleReminderMessage(customer, tickets) {
  return TEMPLATES.sampleReminderMulti(customer, tickets);
}

export const TEMPLATE_LABELS = {
  sampleReminder: "Sample reminder",
  priceReminder: "Price reminder",
  orderReminder: "Order reminder",
  meetingReminder: "Meeting reminder",
  thankYou: "Thank you",
  greeting: "Greeting",
};
