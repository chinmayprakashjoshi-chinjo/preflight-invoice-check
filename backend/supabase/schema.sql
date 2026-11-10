-- PreFlight Database Schema (Supabase Postgres)
-- Matches PRD Section 14.2 & Section 14.3

-- 1. Clients Table
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_entity text,
  ap_email text,
  created_at timestamptz not null default now()
);

-- 2. Client Documents Table
create table if not exists client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null check (kind in ('pdf', 'text', 'email')),
  storage_path text,                 -- Supabase Storage path for uploaded PDFs
  source_text text not null,         -- extracted or pasted text used for evidence checks
  source_text_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_documents_client_id on client_documents (client_id);

-- 3. Requirements Table
create table if not exists requirements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  document_id uuid references client_documents(id) on delete set null,
  key text not null,
  label text not null,
  value jsonb not null,
  evidence text not null,
  evidence_verified boolean not null default false,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  source text not null check (source in ('ai', 'user', 'email')),
  is_new boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_requirements_client_id on requirements (client_id);

-- 4. Invoices Table
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  client_id uuid references clients(id),
  bill_to text not null,
  send_to text not null,
  currency text not null check (currency in ('USD', 'EUR')),
  payment_terms text not null,
  po_reference text,
  tax_id text,
  invoice_date date not null,
  due_date date not null,
  total numeric(12, 2) not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),  -- 'overdue' is derived at read-time
  paypal_invoice_id text unique,
  payer_view_url text,
  preflight_summary jsonb,           -- {blockers, warnings, passed, issues[]} at send time
  updated_via text check (updated_via in ('app', 'webhook', 'poll')),
  paypal_debug_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- DB-01 check constraint: status in ('sent','paid') requires paypal_invoice_id is not null
  constraint chk_invoices_paypal_id_when_sent_or_paid check (
    status = 'draft' or paypal_invoice_id is not null
  )
);

create index if not exists idx_invoices_status on invoices (status);
create index if not exists idx_invoices_client_id on invoices (client_id);

-- 5. Invoice Items Table
create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  position int not null,
  description text not null,
  quantity numeric(10, 2) not null,
  unit_price numeric(12, 2) not null
);

create index if not exists idx_invoice_items_invoice_id on invoice_items (invoice_id);

-- 6. Webhook Events Table
create table if not exists webhook_events (
  event_id text primary key,         -- PayPal event id; guarantees idempotency (DB-03)
  event_type text not null,
  paypal_invoice_id text,
  payload jsonb not null,
  verified boolean not null default false,
  processed_at timestamptz,
  received_at timestamptz not null default now()
);

create index if not exists idx_webhook_events_paypal_invoice_id on webhook_events (paypal_invoice_id);

-- DB-06: Sequential per year and unique invoice number generator
-- Returns formatted string: INV-<year>-<4 digit sequence> (e.g. INV-2026-0001)
create or replace function next_invoice_number(target_year int default extract(year from now())::int)
returns text
language plpgsql
as $$
declare
  yr_str text := target_year::text;
  prefix text := 'INV-' || yr_str || '-';
  max_num int;
  next_num int;
begin
  select coalesce(
    max(
      nullif(
        substring(invoice_number from 'INV-' || yr_str || '-([0-9]+)'),
        ''
      )::int
    ),
    0
  )
  into max_num
  from invoices
  where invoice_number like prefix || '%';

  next_num := max_num + 1;
  return prefix || lpad(next_num::text, 4, '0');
end;
$$;
