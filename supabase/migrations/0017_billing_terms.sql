-- =============================================================================
-- PG360 · 0017_billing_terms.sql — platform billing invoices + terms acceptance.
--   • platform_invoices: PG360 bills a PG account for the subscription. Amount
--     is fully customizable per client; printable; super-admin managed.
--   • profiles.terms_accepted_at / terms_version: first-login T&C acceptance.
-- Additive + idempotent.
-- =============================================================================

create sequence if not exists public.platform_invoice_seq start 1001;

create table if not exists public.platform_invoices (
  id           uuid primary key default gen_random_uuid(),
  pg_id        uuid not null references public.pg_accounts (id) on delete cascade,
  number       bigint not null default nextval('public.platform_invoice_seq'),
  description  text not null default 'PG360 subscription',
  amount       numeric not null check (amount >= 0),
  tax_percent  numeric not null default 0 check (tax_percent >= 0),
  period_label text,
  issue_date   date not null default current_date,
  due_date     date,
  status       text not null default 'unpaid' check (status in ('unpaid','paid')),
  notes        text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_platform_invoices_pg on public.platform_invoices (pg_id, created_at desc);

alter table public.platform_invoices enable row level security;

-- super-admin manages everything; an owner may read their own PG's invoices.
drop policy if exists platform_invoices_super_all on public.platform_invoices;
create policy platform_invoices_super_all on public.platform_invoices
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

drop policy if exists platform_invoices_owner_read on public.platform_invoices;
create policy platform_invoices_owner_read on public.platform_invoices
  for select to authenticated
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

-- ---- first-login terms & conditions acceptance -----------------------------
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version     text;
