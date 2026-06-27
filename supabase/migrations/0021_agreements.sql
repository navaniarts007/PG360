-- =============================================================================
-- PG360 · 0021_agreements.sql — custom resident agreement + signatures.
-- An admin builds a policy as ordered sections; on first login the tenant agrees
-- to each section and signs. The signed agreement (owner + tenant signatures) is
-- stored and shown on the profile + printable record. Reusable across editions.
-- Additive + idempotent.
-- =============================================================================

-- admin-defined, ordered policy sections (the agreement body)
create table if not exists public.agreement_sections (
  id         uuid primary key default gen_random_uuid(),
  pg_id      uuid not null references public.pg_accounts (id) on delete cascade,
  idx        int  not null default 0,
  title      text not null,
  body       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_agreement_sections_pg on public.agreement_sections (pg_id, idx);

-- one signed agreement per tenant
create table if not exists public.tenant_agreements (
  id            uuid primary key default gen_random_uuid(),
  pg_id         uuid not null references public.pg_accounts (id) on delete cascade,
  tenant_id     uuid not null references public.tenants (id) on delete cascade unique,
  signature_url text not null,
  accepted_at   timestamptz not null default now()
);

-- the owner's signature, applied to every agreement for the property
alter table public.pg_accounts
  add column if not exists owner_signature_url text;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.agreement_sections enable row level security;
alter table public.tenant_agreements  enable row level security;

drop policy if exists agreement_sections_staff on public.agreement_sections;
create policy agreement_sections_staff on public.agreement_sections
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists agreement_sections_tenant_read on public.agreement_sections;
create policy agreement_sections_tenant_read on public.agreement_sections
  for select using (pg_id = public.current_pg_id() and public.current_role() = 'tenant');

drop policy if exists agreement_sections_super on public.agreement_sections;
create policy agreement_sections_super on public.agreement_sections
  for select using (public.current_role() = 'super_admin');

drop policy if exists tenant_agreements_tenant on public.tenant_agreements;
create policy tenant_agreements_tenant on public.tenant_agreements
  for all
  using (public.current_role() = 'tenant' and tenant_id = public.current_tenant_id())
  with check (public.current_role() = 'tenant' and tenant_id = public.current_tenant_id());

drop policy if exists tenant_agreements_staff_read on public.tenant_agreements;
create policy tenant_agreements_staff_read on public.tenant_agreements
  for select using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists tenant_agreements_super on public.tenant_agreements;
create policy tenant_agreements_super on public.tenant_agreements
  for select using (public.current_role() = 'super_admin');
