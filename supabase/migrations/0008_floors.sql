-- =============================================================================
-- PG360 · 0008_floors.sql — floors as first-class entities.
-- Owners create a floor (even empty), then add rooms into it. rooms.floor_id
-- links a room to its floor; the old rooms.floor int is kept in sync for
-- display/back-compat. Idempotent (incl. backfill from existing room.floor).
-- =============================================================================

create table if not exists public.floors (
  id         uuid primary key default gen_random_uuid(),
  pg_id      uuid not null references public.pg_accounts (id) on delete cascade,
  name       text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_floors_pg on public.floors (pg_id);

alter table public.rooms
  add column if not exists floor_id uuid references public.floors (id) on delete set null;

-- ---- RLS: staff manage their properties' floors; super_admin reads ---------
alter table public.floors enable row level security;

drop policy if exists floors_staff_all on public.floors;
create policy floors_staff_all on public.floors
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists floors_super_read on public.floors;
create policy floors_super_read on public.floors
  for select using (public.current_role() = 'super_admin');

-- ---- backfill: one floor per distinct room.floor, then link rooms ----------
insert into public.floors (pg_id, name, sort_order)
select distinct r.pg_id,
       case when r.floor = 0 then 'Ground floor' else 'Floor ' || r.floor end,
       r.floor
from public.rooms r
where not exists (
  select 1 from public.floors f where f.pg_id = r.pg_id and f.sort_order = r.floor
);

update public.rooms
set floor_id = f.id
from public.floors f
where f.pg_id = public.rooms.pg_id
  and f.sort_order = public.rooms.floor
  and public.rooms.floor_id is null;
