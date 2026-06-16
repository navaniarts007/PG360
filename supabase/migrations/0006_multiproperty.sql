-- =============================================================================
-- PG360 · 0006_multiproperty.sql
-- Owner -> many properties. `pg_accounts` stays the property table; we add an
-- ownership + membership layer and refactor staff RLS from a single pg_id to
-- "any property the user is a member of". Tenant policies are unchanged
-- (tenants remain single-property via profiles.pg_id + current_tenant_id()).
-- Idempotent: safe to re-run.
-- =============================================================================

-- ---- ownership + per-property settings ------------------------------------
alter table public.pg_accounts
  add column if not exists owner_id uuid references auth.users (id) on delete set null,
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- ---- property membership (admins/staff; the owner gets an 'admin' row) -----
create table if not exists public.property_members (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.pg_accounts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('admin', 'staff')),
  created_at  timestamptz not null default now(),
  unique (property_id, user_id)
);
create index if not exists idx_property_members_user on public.property_members (user_id);

-- ---- RLS helper: the set of properties the caller may touch ----------------
create or replace function public.current_property_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select property_id from public.property_members where user_id = auth.uid();
$$;

-- ---- backfill from the existing single-PG model ---------------------------
insert into public.property_members (property_id, user_id, role)
select p.pg_id, p.id, p.role
from public.profiles p
where p.role in ('admin', 'staff') and p.pg_id is not null
on conflict (property_id, user_id) do nothing;

update public.pg_accounts pa
set owner_id = p.id
from public.profiles p
where p.role = 'admin' and p.pg_id = pa.id and pa.owner_id is null;

-- =============================================================================
-- RLS refactor: staff policies now scope by membership instead of current_pg_id()
-- =============================================================================
alter table public.property_members enable row level security;

-- a member sees their own membership rows; super_admin sees all
drop policy if exists property_members_self_read on public.property_members;
create policy property_members_self_read on public.property_members
  for select using (user_id = auth.uid() or public.current_role() = 'super_admin');

-- pg_accounts: members read; admins update their own; super_admin full
drop policy if exists pg_member_read on public.pg_accounts;
create policy pg_member_read on public.pg_accounts
  for select using (
    id = public.current_pg_id() or id in (select public.current_property_ids())
  );

drop policy if exists pg_admin_update on public.pg_accounts;
create policy pg_admin_update on public.pg_accounts
  for update
  using (id in (select public.current_property_ids()) and public.current_role() = 'admin')
  with check (id in (select public.current_property_ids()) and public.current_role() = 'admin');

-- rooms
drop policy if exists rooms_staff_all on public.rooms;
create policy rooms_staff_all on public.rooms
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

-- tenants
drop policy if exists tenants_staff_all on public.tenants;
create policy tenants_staff_all on public.tenants
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

-- payments
drop policy if exists payments_staff_all on public.payments;
create policy payments_staff_all on public.payments
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

-- issues
drop policy if exists issues_staff_all on public.issues;
create policy issues_staff_all on public.issues
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

-- bookings
drop policy if exists bookings_staff_all on public.bookings;
create policy bookings_staff_all on public.bookings
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

-- food_menu (staff manage; member read policy food_menu_member_read unchanged)
drop policy if exists food_menu_staff_all on public.food_menu;
create policy food_menu_staff_all on public.food_menu
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

-- food_opt (staff read; tenant self policy food_opt_self_all unchanged)
drop policy if exists food_opt_staff_read on public.food_opt;
create policy food_opt_staff_read on public.food_opt
  for select
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

-- expenses
drop policy if exists expenses_staff_all on public.expenses;
create policy expenses_staff_all on public.expenses
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));
