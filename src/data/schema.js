// schema.js — shared enums / shape reference so every module agrees on
// the same vocabulary. Not enforced at runtime (no backend/DB constraints
// yet) but treat these as the source of truth when adding fields.

export const CUSTOMER_STATUS = ["Active", "Potential", "Inactive", "Lost"];

export const CUSTOMER_CATEGORY = [
  "Manufacturer",
  "Exporter",
  "Brand",
  "Trader",
  "Boutique",
];

export const PRODUCT_CATEGORY = [
  "RFD",
  "Dyed",
  "Ecru",
  "Formal",
  "Cotlook",
  "Polyester",
  "Polyester Lycra",
  "Cotton",
  "Cotton Lycra",
  "Cotton Poly Lycra",
  "Dobby",
  "Imported Yarn",
];

export const SAMPLE_TYPE = ["Cutting", "1 Pc", "Hanger", "Shade Card"];

export const DISPATCH_MODE = ["Courier", "Hand Delivered"];

export const TICKET_STAGES = [
  "Sample Sent",
  "Received",
  "Testing",
  "Approved",
  "Rejected",
  "Need Revised Sample",
  "Price Discussion",
  "Trial Order",
  "Bulk Order",
  "Lost",
];

// Stages that count as "won" / "lost" for conversion math
export const WON_STAGES = ["Trial Order", "Bulk Order"];
export const LOST_STAGES = ["Rejected", "Lost"];
export const OPEN_STAGES = TICKET_STAGES.filter(
  (s) => !WON_STAGES.includes(s) && !LOST_STAGES.includes(s)
);

export const FOLLOWUP_MODE = [
  "Phone",
  "WhatsApp",
  "Meeting",
  "Email",
  "Video Call",
];

export const FOLLOWUP_PRIORITY = ["High", "Medium", "Low"];

export const FOLLOWUP_STATUS = [
  "Interested",
  "Waiting",
  "Busy",
  "Need New Shade",
  "Need Revised Fabric",
  "Price High",
  "Waiting Season",
  "Order Expected",
  "Lost",
];

// Scoring weights — rule-based, NOT ML. See utils/scoring.js
export const SCORE_RULES = {
  visitedRecently: 20, // activity (follow-up) within last 14 days
  sampleApproved: 30,
  trialOrder: 50,
  bulkOrder: 100,
  lost: -50,
  inactive30Days: -20,
};

// Order-probability weights per ticket — also rule-based (see
// utils/scoring.js -> ticketProbability). Expressed as % points added,
// clamped to 0-95 (never claim certainty).
export const PROBABILITY_RULES = {
  base: 10,
  garmentDeveloped: 15,
  receivedByCustomer: 10,
  stage: {
    "Sample Sent": 0,
    "Received": 5,
    "Testing": 10,
    "Approved": 30,
    "Price Discussion": 35,
    "Need Revised Sample": 5,
    "Trial Order": 70,
    "Bulk Order": 90,
    "Rejected": 0,
    "Lost": 0,
  },
  perRecentFollowUp: 5, // follow-up logged in last 14 days, max 3 counted
};

export const SEASONS = ["Spring/Summer", "Autumn/Winter", "Festive", "School Uniform", "Formal/Corporate"];

// Shape reference (not enforced, just documentation):
//
// Customer { id, name, company, gst, city, state, country, buyerName,
//   designerName, purchasePerson, accountsPerson, phone, whatsapp, email,
//   address, website, instagram, category, monthlyConsumption,
//   preferredFabric, preferredGSM, preferredWidth, preferredPrice,
//   creditDays, remarks, status, createdAt, updatedAt }
//
// Product { id, category, subCategory, qualityName, construction,
//   composition, gsm, width, finish, millName, colour, moq, price,
//   remarks, photo, createdAt, updatedAt }
//
// Ticket { id, ticketNumber, date, customerId, productId, shade, quantity,
//   unit, sampleType, dispatchMode, courierName, trackingNumber,
//   dispatchDate, expectedDelivery, received, garmentDeveloped, stage,
//   remarks, createdAt, updatedAt }
//
// FollowUp { id, ticketId, date, time, mode, discussion, nextFollowUpDate,
//   priority, status, createdAt, updatedAt }
