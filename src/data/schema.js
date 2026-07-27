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
