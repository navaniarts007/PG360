-- =============================================================================
-- PG360 · 0014_tenant_records.sql — tenant records & activity log.
-- Adds a per-property sequential registration number, and a per-tenant event
-- timeline (joined / room change / payment / complaint / checked-out) used by
-- the police-style profile + Vacated Master (GVM edition; reusable everywhere).
-- Additive + idempotent.
-- =============================================================================

-- ---- sequential registration number (e.g. GVM-0001) ------------------------
alter table public.tenants
  add column if not exists reg_no text;

create table if not exists public.tenant_counters (
  pg_id   uuid primary key references public.pg_accounts (id) on delete cascade,
  next_no int not null default 1
);

-- atomically hand out the next number for a property
create or replace function public.next_tenant_no(p_pg uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  insert into public.tenant_counters (pg_id, next_no) values (p_pg, 1)
  on conflict (pg_id) do update set next_no = public.tenant_counters.next_no + 1
  returning next_no into n;
  return n;
end $$;

-- ---- tenant activity / event timeline --------------------------------------
create table if not exists public.tenant_events (
  id         uuid primary key default gen_random_uuid(),
  pg_id      uuid not null references public.pg_accounts (id) on delete cascade,
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  type       text not null check (type in ('joined','room_changed','payment','complaint','note','checked_out')),
  detail     text,
  room_id    uuid references public.rooms (id) on delete set null,
  floor      int,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_tenant_events_tenant on public.tenant_events (tenant_id, created_at);
create index if not exists idx_tenant_events_pg on public.tenant_events (pg_id);

-- =============================================================================
-- RLS: staff manage their properties' counters + events; super reads.
-- =============================================================================
alter table public.tenant_counters enable row level security;
alter table public.tenant_events   enable row level security;

drop policy if exists tenant_counters_staff_all on public.tenant_counters;
create policy tenant_counters_staff_all on public.tenant_counters
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists tenant_events_staff_all on public.tenant_events;
create policy tenant_events_staff_all on public.tenant_events
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists tenant_events_super_read on public.tenant_events;
create policy tenant_events_super_read on public.tenant_events
  for select using (public.current_role() = 'super_admin');
