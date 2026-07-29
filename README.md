# Amihem CRM — Phase 1

Textile sample-to-order conversion tracker. Offline-first (IndexedDB), no
backend required. Built with Vite + React + Tailwind.

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
CRA, so double-check that setting if you're used to your other app).

## What's built (Phase 1 + Phase 2)
**Phase 1**
- **Dashboard** — today's/overdue follow-ups, pending samples, conversion %
- **Customer Master** — full CRUD, search, status filter
- **Product Master** — full CRUD (qualities, GSM, mill, price)
- **Sample Management** — tickets with stage tracking, courier info
- **Follow-up Module** — unlimited follow-ups per ticket, priority,
  automatic overdue flagging
- **WhatsApp Integration** — one-click templated wa.me links per ticket
- **Reports** — CSV export (customer / sample / pending / follow-up)

**Phase 2**
- **Pipeline** — Kanban board of all tickets, drag a card to change stage
- **Analytics** — conversion KPIs, stage breakdown, monthly trend,
  city-wise and product-category-wise conversion, top customers by volume
- **Customer Detail / Timeline** — click any customer to see their full
  chronological history (samples, follow-ups, calls) in one place
- **Customer Scoring** — Hot / Warm / Cold badge, rule-based (see
  `src/utils/scoring.js` — explicitly not ML, weights are editable)
- **Call Log** — log calls against a customer from their detail page,
  feeds into the timeline and score

**Phase 3**
- **Excel/CSV Import** — Settings → Import Customers / Import Products,
  accepts .xlsx/.xls/.csv with flexible column-name matching
- **Backup / Restore** — Settings → download full JSON backup, restore
  from a backup file (merges by ID)
- **Login with Roles** — Admin / Manager / Sales Executive. **This is
  UI-level gating only, not real security** (no backend = no real access
  control) — it hides destructive actions (delete) from non-Admins and
  hides Settings from Sales Executives. See
  `src/context/AuthContext.jsx` for the honest explanation of what this
  does and doesn't protect.

Seeded with demo data on first load so it's usable immediately — open the
app, poke around, then clear IndexedDB (`amihem_crm` DB in devtools) if you
want to start clean.

Note: if you're upgrading from a Phase 1 install, the IndexedDB schema
version bumped (adds a `calls` store) — it upgrades automatically on next
load, no action needed on your end.

First launch now asks for a name + role (stored only in this browser, no
password, no server) — this is just for personalizing what's shown.

**Additional modules** (accessible via sidebar "More" on desktop, ⋯ menu
on mobile):
- **Route Planner** — group customers by city, build a day's visit list,
  check off as you go
- **Seasonal Collections** — plan Autumn/Winter, Spring/Summer, festive,
  etc. launches with linked products and a launch-date reminder
- **Fabric Book & Hanger Inventory** — track sample books/hangers/cut
  pieces on hand by quality and shade, so you don't dispatch duplicates
- **Order Probability** — each sample ticket now shows a rule-based %
  likelihood of converting (see `PROBABILITY_RULES` in `data/schema.js`
  to tune the weights)
- **Courier POD tracking** — courier charges and POD-received status on
  each ticket

## Architecture — read this before extending
**All data access goes through `src/services/dataService.js`.** Components
never touch IndexedDB directly — they go through the domain hooks
(`useCustomers`, `useProducts`, `useTickets`, `useFollowUps` in
`src/context/domains.jsx`), which are all built off one factory
(`createDomainContext.jsx`) so adding a new entity (e.g. `visits`,
`calls`) is: add a store name in `dataService.js`, call
`createDomainContext()` once, done.

This is what makes migrating to Supabase later a swap of `dataService.js`
internals, not a rewrite — same reasoning you already applied to
`trdsls-app`.

```
/src
  /components   — StatusBadge, KpiCard, Modal, FormField, AppShell
  /pages        — Dashboard, Customers, Products, Tickets, Reports
  /context      — domain contexts (customers/products/tickets/followups)
  /services     — dataService.js (IndexedDB), whatsapp.js
  /utils        — helpers.js (dates, CSV, ticket numbering)
  /data         — schema.js (enums/shape reference), seed.js (demo data)
```

## Switching to Supabase (cloud sync across devices)

By default the app runs entirely on IndexedDB — offline, per-device, no
login needed beyond a name. To get cross-device sync (same pattern you
already use in `trdsls-app`), switch to Supabase:

**1. Create the tables**
In your Supabase project → SQL Editor, run `supabase/schema.sql` — creates
one real table per store (`customers`, `products`, `tickets`,
`followups`, `calls`, `inventory`, `collections`, `visits`) with proper
columns, foreign keys (`tickets.customer_id → customers.id`,
`followups.ticket_id → tickets.id`, etc.), and RLS so every row is scoped
to `auth.uid()`. This is a real relational schema — you can query it
directly in Supabase's Table Editor or SQL, not just through the app.

**2. Set your env vars**
```
cp .env.example .env
```
Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase →
Project Settings → API.

**3. That's it — nothing else changes**
`dataService.js` auto-detects the env vars and routes every read/write to
`supabaseBackend.js` instead of `indexedDbBackend.js`. `supabaseBackend.js`
converts camelCase JS fields to snake_case columns automatically, so a
"store" name (e.g. `tickets`) maps straight to a real table of the same
name — no component, hook, or page needed to change.

**One real change you'll notice:** the login screen switches from
"name + role" to real email/password (Sign In / Create Account), because
Supabase's Row Level Security needs an actual authenticated user to know
whose data is whose. Role (Admin/Manager/Sales Executive) is still just a
local UI preference layered on top — see `src/context/AuthContext.jsx`.

**Files involved:**
```
src/services/supabaseClient.js    — client init, only active if env vars set
src/services/supabaseBackend.js   — Supabase implementation (camelCase <-> snake_case, generic across all tables)
src/services/supabaseAuth.js      — signUp/signIn/signOut/onAuthChange
src/services/indexedDbBackend.js  — original IndexedDB implementation
src/services/dataService.js       — router: picks backend automatically
supabase/schema.sql               — run this once in Supabase SQL Editor
.env.example                      — copy to .env with your project keys
```

**Migrating existing IndexedDB data to Supabase:** use Settings → Backup
to export your current data as JSON first (works on either backend). Once
you've switched to Supabase and signed in, importing that same JSON back
via Settings → Restore will push it into Supabase instead — the restore
function also goes through `dataService.js`, so it doesn't need to know
which backend is active either.

## Not built yet
Courier POD reconciliation reports and fabric-book-level batch tracking
are intentionally kept simple (the fields exist, but there's no
low-stock alerting yet). Ask if you want that added.
