-- =============================================================================
-- PG360 · 0022_tenant_documents.sql — multiple ID documents per tenant.
-- Beyond the single Aadhaar photo, a tenant can have several proofs (Aadhaar,
-- driving license, passport, voter ID, other), each a private Cloudinary asset
-- shown on the profile + printable record. Additive + idempotent.
-- =============================================================================

create table if not exists public.tenant_documents (
  id         uuid primary key default gen_random_uuid(),
  pg_id      uuid not null references public.pg_accounts (id) on delete cascade,
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  doc_type   text not null check (doc_type in ('aadhaar','dl','passport','voter','other')),
  file_url   text not null,
  label      text,
  created_at timestamptz not null default now()
);
create index if not exists idx_tenant_documents_tenant on public.tenant_documents (tenant_id);

alter table public.tenant_documents enable row level security;

drop policy if exists tenant_documents_staff on public.tenant_documents;
create policy tenant_documents_staff on public.tenant_documents
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists tenant_documents_tenant_read on public.tenant_documents;
create policy tenant_documents_tenant_read on public.tenant_documents
  for select using (public.current_role() = 'tenant' and tenant_id = public.current_tenant_id());

drop policy if exists tenant_documents_super on public.tenant_documents;
create policy tenant_documents_super on public.tenant_documents
  for select using (public.current_role() = 'super_admin');
