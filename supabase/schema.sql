-- Amihem CRM — Supabase schema (normalized tables)
-- Run this once in your Supabase project's SQL Editor.
--
-- One real table per store (customers, products, tickets, followups,
-- calls, inventory, collections, visits) with proper columns and
-- foreign keys — tickets.customer_id -> customers.id,
-- followups.ticket_id -> tickets.id, and so on. This is the schema you'd
-- want if you ever query/report directly in Supabase (Table Editor, SQL,
-- or a BI tool), not just through the app.
--
-- App-side, this stays fully generic: supabaseBackend.js converts
-- camelCase JS fields <-> snake_case columns automatically, so adding a
-- field to a form doesn't require touching supabaseBackend.js — only
-- this file, to add the column.

create extension if not exists "uuid-ossp";

-- ---------- customers ----------
create table if not exists public.customers (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  gst text,
  city text,
  state text,
  country text,
  buyer_name text,
  designer_name text,
  purchase_person text,
  accounts_person text,
  phone text,
  whatsapp text,
  email text,
  address text,
  website text,
  instagram text,
  category text,
  monthly_consumption text,
  preferred_fabric text,
  preferred_gsm text,
  preferred_width text,
  preferred_price text,
  credit_days text,
  remarks text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_user_idx on public.customers (user_id);

-- ---------- products ----------
create table if not exists public.products (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text,
  sub_category text,
  quality_name text not null,
  construction text,
  composition text,
  gsm text,
  width text,
  finish text,
  mill_name text,
  colour text,
  moq text,
  price text,
  remarks text,
  photo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_user_idx on public.products (user_id);

-- ---------- tickets (sample management) ----------
create table if not exists public.tickets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_number text,
  date date,
  customer_id uuid references public.customers(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  shade text,
  quantity text,
  unit text,
  sample_type text,
  dispatch_mode text,
  courier_name text,
  tracking_number text,
  courier_charges text,
  pod_received boolean default false,
  dispatch_date date,
  expected_delivery date,
  received boolean default false,
  garment_developed boolean default false,
  stage text,
  remarks text,
  closure_note text,
  order_value text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_user_idx on public.tickets (user_id);
create index if not exists tickets_customer_idx on public.tickets (customer_id);

-- ---------- followups ----------
create table if not exists public.followups (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete cascade,
  date date,
  time text,
  mode text,
  discussion text,
  next_follow_up_date date,
  priority text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists followups_user_idx on public.followups (user_id);
create index if not exists followups_ticket_idx on public.followups (ticket_id);

-- ---------- calls ----------
create table if not exists public.calls (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  date date,
  duration text,
  discussion text,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calls_user_idx on public.calls (user_id);
create index if not exists calls_customer_idx on public.calls (customer_id);

-- ---------- inventory (fabric book / hanger stock) ----------
create table if not exists public.inventory (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  item_type text,
  shade text,
  quantity text,
  location text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_user_idx on public.inventory (user_id);

-- ---------- collections (seasonal planner) ----------
create table if not exists public.collections (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  season text,
  launch_date date,
  product_ids jsonb default '[]'::jsonb,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collections_user_idx on public.collections (user_id);

-- ---------- visits (route planner) ----------
create table if not exists public.visits (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  planned_date date,
  visited boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists visits_user_idx on public.visits (user_id);

-- ---------- attachments (garment/dispatch photos on tickets) ----------
-- data_url stores a compressed base64 JPEG (resized client-side before
-- upload) — simplest path with no separate file-storage setup. If volume
-- grows large, migrate to Supabase Storage and keep only a URL here.
create table if not exists public.attachments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete cascade,
  label text,
  data_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists attachments_user_idx on public.attachments (user_id);
create index if not exists attachments_ticket_idx on public.attachments (ticket_id);

-- ---------- Row Level Security: every user sees/edits only their own rows ----------
do $$
declare
  t text;
begin
  for t in select unnest(array['customers','products','tickets','followups','calls','inventory','collections','visits','attachments'])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('create policy "select own rows" on public.%I for select using (auth.uid() = user_id);', t);
    execute format('create policy "insert own rows" on public.%I for insert with check (auth.uid() = user_id);', t);
    execute format('create policy "update own rows" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format('create policy "delete own rows" on public.%I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- ---------- Migration: safe to re-run if you already applied an earlier
-- version of this schema — adds any columns introduced since then ----------
alter table public.tickets add column if not exists closure_note text;
alter table public.tickets add column if not exists order_value text;
alter table public.tickets add column if not exists closed_at timestamptz;

-- ---------- Migrating from the old single-table (user_data) design ----------
-- If you previously ran an earlier version of this file that created a
-- `user_data` JSONB table, the app now reads/writes these normalized
-- tables instead. To move old rows over, per store:
--
--   insert into public.customers (id, user_id, name, city, buyer_name, ...)
--   select (record_id)::uuid, user_id, data->>'name', data->>'city', data->>'buyerName', ...
--   from public.user_data where store = 'customers';
--
-- Repeat for each store, matching data->>'camelCaseField' to the right
-- snake_case column, then `drop table public.user_data;` once verified.
