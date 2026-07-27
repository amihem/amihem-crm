// whatsapp.js — builds wa.me deep links with pre-filled templates.
// No API/business account needed; this just opens WhatsApp with text ready.

const TEMPLATES = {
  sampleReminder: (c, t) =>
    `Hi ${c.buyerName || c.name}, following up on the ${t.shade || ""} sample (${t.ticketNumber}) we sent — could you share an update on how it's looking?`,
  priceReminder: (c, t) =>
    `Hi ${c.buyerName || c.name}, checking in on the pricing discussion for ${t.ticketNumber}. Let us know if you'd like to move ahead.`,
  orderReminder: (c, t) =>
    `Hi ${c.buyerName || c.name}, just following up on ${t.ticketNumber} — is the order ready to be confirmed on our end?`,
  meetingReminder: (c) =>
    `Hi ${c.buyerName || c.name}, would you have some time this week for a quick meeting to go over new qualities?`,
  thankYou: (c) =>
    `Hi ${c.buyerName || c.name}, thank you for your time today — always a pleasure. We'll follow up as discussed.`,
  greeting: (c) =>
    `Hi ${c.buyerName || c.name}, hope you're doing well! Just checking in from our side.`,
};

export function buildWhatsAppLink(phone, message) {
  const digits = String(phone || "").replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export function getTemplateMessage(templateKey, customer, ticket) {
  const fn = TEMPLATES[templateKey];
  return fn ? fn(customer, ticket) : "";
}

export const TEMPLATE_LABELS = {
  sampleReminder: "Sample reminder",
  priceReminder: "Price reminder",
  orderReminder: "Order reminder",
  meetingReminder: "Meeting reminder",
  thankYou: "Thank you",
  greeting: "Greeting",
};
