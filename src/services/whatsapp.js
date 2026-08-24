// whatsapp.js — builds wa.me deep links with pre-filled templates.
// No API/business account needed; this just opens WhatsApp with text ready.
//
// Message content: no ticket number, no internal dates — only fabric
// specs the customer actually needs to identify the sample (quality,
// shade, GSM/OZ, type, composition).

import { getCompanyName } from "./companyProfile";
import { computeFabricWeights } from "../utils/fabricWeight";

function signOff() {
  return `Regards\n${getCompanyName()}`;
}

function partyName(c) {
  return c.name || c.buyerName || "";
}

// Merges the matching Product record's fabric spec onto a ticket, so
// templates below have qualityName/gsm/oz/category/composition to hand —
// call this at the point you already have both `ticket` and `product`.
export function attachProductInfo(ticket, product) {
  if (!product) return { ...ticket, productName: "Sample" };
  const { oz } = computeFabricWeights(product.gsm, "gsm", product.width);
  return {
    ...ticket,
    productName: product.qualityName || "Sample",
    gsm: product.gsm || "",
    oz: oz ?? "",
    category: product.category || "",
    composition: product.composition || "",
  };
}

function productLine(t) {
  return `${t.productName || "Sample"}${t.shade ? ` — ${t.shade}` : ""}`;
}

// One numbered block per sample — only fabric-relevant fields, exactly
// the format requested: quality/shade line, then GSM & Oz / Type /
// Composition, each label kept even when a field is blank (matches the
// approved template rather than silently dropping lines).
function sampleBlock(t, index) {
  const gsmOz = [t.gsm ? `${t.gsm} GSM` : "", t.oz ? `${t.oz} Oz` : ""].filter(Boolean).join(" / ");
  const prefix = index ? `${index}. ` : "";
  return [
    `${prefix}*${productLine(t)}*`,
    `GSM & Oz : ${gsmOz}`,
    `Type : ${t.category || ""}`,
    `Composition : ${t.composition || ""}`,
  ].join("\n");
}

const TEMPLATES = {
  sampleReminder: (c, t) =>
    `${getCompanyName()}\n\nDear *${partyName(c)}*,\n\nThis is a follow-up regarding the sample sent to you:\n\n${sampleBlock(t)}\n\nKindly revert at the earliest.\n\n${signOff()}`,

  sampleReminderMulti: (c, tickets) => {
    const blocks = tickets.map((t, i) => sampleBlock(t, i + 1)).join("\n\n");
    return `${getCompanyName()}\n\nDear *${partyName(c)}*,\n\nThis is a follow-up regarding the samples sent to you:\n\n${blocks}\n\nKindly revert at the earliest.\n\n${signOff()}`;
  },

  priceReminder: (c, t) =>
    `${getCompanyName()}\n\nDear *${partyName(c)}*,\n\nFollowing up on the pricing discussion for:\n\n*${productLine(t)}*\n\nKindly let us know if you'd like to move ahead.\n\n${signOff()}`,

  orderReminder: (c, t) =>
    `${getCompanyName()}\n\nDear *${partyName(c)}*,\n\nFollowing up on:\n\n*${productLine(t)}*\n\nKindly confirm if the order can be finalised from your end.\n\n${signOff()}`,

  meetingReminder: (c) =>
    `${getCompanyName()}\n\nDear *${partyName(c)}*,\n\nWould you have some time this week for a quick meeting to go over our new qualities?\n\n${signOff()}`,

  thankYou: (c) =>
    `${getCompanyName()}\n\nDear *${partyName(c)}*,\n\nThank you for your time today — always a pleasure. We'll follow up as discussed.\n\n${signOff()}`,

  greeting: (c) =>
    `${getCompanyName()}\n\nDear *${partyName(c)}*,\n\nHope you're doing well! Just checking in from our side.\n\n${signOff()}`,
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
