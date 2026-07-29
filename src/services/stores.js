// stores.js — the list of logical "tables" both backends implement.
// Kept separate so both indexedDbBackend.js and supabaseBackend.js
// import the same names without a circular dependency on dataService.js.
export const STORES = {
  customers: "customers",
  products: "products",
  tickets: "tickets",
  followups: "followups",
  calls: "calls",
  inventory: "inventory",
  collections: "collections",
  visits: "visits",
};
