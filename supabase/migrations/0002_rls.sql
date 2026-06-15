-- =============================================================================
-- PG360 · 0002_rls.sql
-- Row Level Security. RLS is the REAL security boundary — never the UI.
-- Rules:
--   super_admin : manage pg_accounts; read platform-wide aggregates.
--   admin/staff : full CRUD only where pg_id = current_pg_id().
--   tenant      : read their own room/pg/payments; insert issues as themselves.
-- =============================================================================

alter table public.profiles    enable row level security;
alter table public.pg_accounts enable row level security;
alter table public.rooms       enable row level security;
alter table public.tenants     enable row level security;
alter table public.payments    enable row level security;
alter table public.issues      enable row level security;

-- ----------------------------------------------------------------- profiles
-- Each user reads their own profile; super_admin reads all.
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.current_role() = 'super_admin');

-- A user may update non-privileged fields on their own profile.
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Inserts into profiles happen via the service role (server-side onboarding).

-- -------------------------------------------------------------- pg_accounts
drop policy if exists pg_super_all on public.pg_accounts;
create policy pg_super_all on public.pg_accounts
  for all using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');

-- Everyone attached to a PG can read that PG row (owner phone, name, etc.).
drop policy if exists pg_member_read on public.pg_accounts;
create policy pg_member_read on public.pg_accounts
  for select using (id = public.current_pg_id());

-- -------------------------------------------------------------------- rooms
drop policy if exists rooms_staff_all on public.rooms;
create policy rooms_staff_all on public.rooms
  for all
  using (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'))
  with check (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'));

-- Tenants read rooms in their PG (needed for My Room + WiFi).
drop policy if exists rooms_tenant_read on public.rooms;
create policy rooms_tenant_read on public.rooms
  for select using (pg_id = public.current_pg_id());

-- super_admin read-only across rooms (aggregates).
drop policy if exists rooms_super_read on public.rooms;
create policy rooms_super_read on public.rooms
  for select using (public.current_role() = 'super_admin');

-- ------------------------------------------------------------------ tenants
drop policy if exists tenants_staff_all on public.tenants;
create policy tenants_staff_all on public.tenants
  for all
  using (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'))
  with check (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'));

-- A tenant reads their own record.
drop policy if exists tenants_self_read on public.tenants;
create policy tenants_self_read on public.tenants
  for select using (user_id = auth.uid());

drop policy if exists tenants_super_read on public.tenants;
create policy tenants_super_read on public.tenants
  for select using (public.current_role() = 'super_admin');

-- ----------------------------------------------------------------- payments
drop policy if exists payments_staff_all on public.payments;
create policy payments_staff_all on public.payments
  for all
  using (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'))
  with check (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'));

-- A tenant reads only their own payments.
drop policy if exists payments_self_read on public.payments;
create policy payments_self_read on public.payments
  for select using (tenant_id = public.current_tenant_id());

drop policy if exists payments_super_read on public.payments;
create policy payments_super_read on public.payments
  for select using (public.current_role() = 'super_admin');

-- ------------------------------------------------------------------- issues
drop policy if exists issues_staff_all on public.issues;
create policy issues_staff_all on public.issues
  for all
  using (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'))
  with check (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'));

-- A tenant reads their own issues...
drop policy if exists issues_self_read on public.issues;
create policy issues_self_read on public.issues
  for select using (tenant_id = public.current_tenant_id());

-- ...and may raise (insert) issues as themselves only.
drop policy if exists issues_self_insert on public.issues;
create policy issues_self_insert on public.issues
  for insert
  with check (
    tenant_id = public.current_tenant_id()
    and pg_id = public.current_pg_id()
    and public.current_role() = 'tenant'
  );
