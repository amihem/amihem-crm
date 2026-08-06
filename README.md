# Amihem CRM

Textile sample-to-order conversion tracker. Offline-first by default
(IndexedDB), optional Supabase backend for cross-device sync. Built with
Vite + React + Tailwind.

## Run locally
```
npm install
npm run dev
```

## Build / deploy
```
npm run build      # outputs to dist/
```
Deploy `dist/` to Vercel — `vercel.json` is already set with
`outputDirectory: dist` (note: **dist**, not `build` — this is Vite, not
CRA).

## What's built

**Dashboard** — today's/overdue follow-ups, pending samples, conversion %,
open queries going stale (7+ days untouched, even without a next-follow-up
date set), low-stock inventory alerts, recently added customers.

**Masters** (Customers + Products under one nav slot, tab-switcher at top
of each page) — full CRUD, alphabetical sort, search-with-dropdown,
bulk select for status change / delete.

**Sample Management** — the core module:
- New tickets support **multiple products/qualities in one go** — pick a
  customer once, add as many product rows as needed, each becomes its own
  ticket sharing the same dispatch/courier details.
- Customer name and product are **blank by default** with type-to-search
  selection, plus **"+ New"** inline shortcuts to add a customer or
  product without leaving the ticket form.
- **Open Queries / Closed / All** toggle — a "query" is a customer's
  sampling request; it stays Open until you explicitly **Close** it with a
  result (order value if won, reason if lost). Nothing gets silently
  forgotten in a stage dropdown.
- Tickets grouped by customer (one card per customer, all their samples
  nested inside) with staleness highlighting.
- Full **Edit** button on every ticket — not just stage, every field.
- Photo attachments (Garment Photo / Dispatch Photo / Other), compressed
  client-side before storing.
- Order-probability % per ticket (rule-based, see `PROBABILITY_RULES` in
  `data/schema.js`).
- Courier + POD tracking (charges, POD received).
- WhatsApp reminder with a **checklist** of which samples to mention —
  builds one message only for the ones you select.

**Analytics** — conversion KPIs, stage breakdown, monthly trend,
city/product-category conversion, top customers, with a **date-range
filter** (This Month / Last 30 / Last 90 / Custom / All Time).

**Customer Detail / Timeline** — full chronological history (samples,
follow-ups, calls) per customer, Hot/Warm/Cold scoring (rule-based, see
`utils/scoring.js`), Call/WhatsApp buttons, call logging.

**Inventory** — fabric book/hanger/shade-card stock by quality, with a
low-stock badge (≤2, threshold in `LOW_STOCK_THRESHOLD` in `data/schema.js`)
that also surfaces on the Dashboard.

**Reports** — CSV, PDF, or share-to-WhatsApp (via the device share sheet)
for Customer / Sample / Pending / Follow-up reports.

**Settings** — Excel/CSV import for Customers & Products (duplicate rows
skipped automatically by name/phone or quality name), JSON backup/restore.

**Login with Roles** — Admin / Manager / Sales Executive. **UI-level
gating only** (hides delete buttons, hides Settings) — see
`src/context/AuthContext.jsx` for what this does and doesn't protect.
Logout is available directly in the sidebar (desktop) and top bar (mobile).

**Overdue reminder popup** — once per day, if there are overdue
follow-ups, a popup surfaces them on app open with one-tap Call/WhatsApp.

## Architecture — read this before extending
**All data access goes through `src/services/dataService.js`.** Components
never touch storage directly — they go through domain hooks
(`useCustomers`, `useProducts`, `useTickets`, `useFollowUps`, `useCalls`,
`useInventory`, `useAttachments` in `src/context/domains.jsx`), all built
off one factory (`createDomainContext.jsx`). Adding a new entity is: add a
store name in `services/stores.js`, call `createDomainContext()` once.

```
/src
  /components   — StatusBadge, KpiCard, Modal, FormField, AppShell,
                   MasterTabs, SearchDropdown, EntitySearchField,
                   QuickAddCustomer, QuickAddProduct, OverdueReminderPopup
  /pages        — Dashboard, Customers, Products, CustomerDetail, Tickets,
                   Analytics, Inventory, Reports, Settings, Login
  /context      — AuthContext, domain contexts
  /services     — dataService.js (router), indexedDbBackend.js,
                   supabaseBackend.js, supabaseAuth.js, whatsapp.js,
                   backupImport.js
  /utils        — helpers.js, scoring.js, image.js (photo compression)
  /data         — schema.js (enums/shape reference), seed.js (demo data)
```

## Switching to Supabase (cloud sync across devices)

By default the app runs entirely on IndexedDB — offline, per-device, no
login needed beyond a name.

**1. Create the tables** — in Supabase SQL Editor, run `supabase/schema.sql`.
One real table per store with foreign keys and RLS scoped to `auth.uid()`.
Safe to re-run if you already applied an earlier version — it uses
`if not exists` and includes `alter table ... add column if not exists`
migrations for columns added since.

**2. Set your env vars**
```
cp .env.example .env
```
Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase →
Project Settings → API.

**3. Nothing else changes** — `dataService.js` auto-detects the env vars
and routes every read/write to `supabaseBackend.js`, which converts
camelCase JS fields to snake_case columns automatically.

**One real change you'll notice:** login switches from "name + role" to
real email/password, because RLS needs an actual authenticated user. Role
is still a local UI preference layered on top.

**Migrating existing IndexedDB data to Supabase:** Settings → Backup to
export JSON first, switch to Supabase, sign in, then Settings → Restore
to push that same JSON in.

## Not built yet
Order/revenue rollup dashboard (order value is captured when you close a
won query, but not yet summarized anywhere), commission calculator. Ask
when you want either.
