-- =============================================================================
-- PG360 · 0007_beds.sql — Bangalore redesign, part 1: beds + rate cards.
-- Bangalore PGs sell BEDS priced by sharing type, not rooms. We add a rate card
-- (price per sharing type) and individual beds; a tenant occupies a bed and
-- their rent derives from it. Existing rooms.rent_amount / occupied_beds are
-- kept (occupied_beds is now auto-synced from beds) for backward-compat display.
-- Idempotent.
-- =============================================================================

-- ---- rate cards: price per sharing type, per property -----------------------
create table if not exists public.rate_cards (
  id                     uuid primary key default gen_random_uuid(),
  pg_id                  uuid not null references public.pg_accounts (id) on delete cascade,
  name                   text not null,                 -- "Double Sharing · AC"
  room_type              text not null,                 -- single|double|triple|quad|dorm (free)
  ac                     boolean not null default false,
  bath_type              text not null default 'common' check (bath_type in ('attached','common')),
  price_per_month        int not null default 0,
  food_included          boolean not null default true,
  food_opt_out_deduction int not null default 0,
  created_at             timestamptz not null default now(),
  unique (pg_id, room_type, ac, bath_type, price_per_month)
);
create index if not exists idx_rate_cards_pg on public.rate_cards (pg_id);

-- ---- beds: the real unit of occupancy + pricing ----------------------------
create table if not exists public.beds (
  id                uuid primary key default gen_random_uuid(),
  pg_id             uuid not null references public.pg_accounts (id) on delete cascade,
  room_id           uuid not null references public.rooms (id) on delete cascade,
  bed_number        text not null,
  rate_card_id      uuid references public.rate_cards (id) on delete set null,
  price_per_month   int not null default 0,
  status            text not null default 'vacant' check (status in ('vacant','occupied')),
  current_tenant_id uuid references public.tenants (id) on delete set null,
  available_from    date,
  notes             text,
  created_at        timestamptz not null default now(),
  unique (room_id, bed_number)
);
create index if not exists idx_beds_pg on public.beds (pg_id);
create index if not exists idx_beds_room on public.beds (room_id);

-- tenant -> bed link
alter table public.tenants
  add column if not exists bed_id uuid references public.beds (id) on delete set null;

-- ---- keep rooms.occupied_beds in sync from beds ----------------------------
create or replace function public.sync_room_occupancy()
returns trigger language plpgsql security definer set search_path = public as $$
declare r uuid;
begin
  r := coalesce(new.room_id, old.room_id);
  update public.rooms
    set occupied_beds = (select count(*) from public.beds where room_id = r and status = 'occupied')
    where id = r;
  return null;
end $$;

drop trigger if exists trg_sync_room_occupancy on public.beds;
create trigger trg_sync_room_occupancy
  after insert or update or delete on public.beds
  for each row execute function public.sync_room_occupancy();

-- =============================================================================
-- RLS: staff manage their properties' rate cards + beds; tenants read beds in
-- their PG (to see their bed number); super_admin reads all.
-- =============================================================================
alter table public.rate_cards enable row level security;
alter table public.beds       enable row level security;

drop policy if exists rate_cards_staff_all on public.rate_cards;
create policy rate_cards_staff_all on public.rate_cards
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists rate_cards_super_read on public.rate_cards;
create policy rate_cards_super_read on public.rate_cards
  for select using (public.current_role() = 'super_admin');

drop policy if exists beds_staff_all on public.beds;
create policy beds_staff_all on public.beds
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists beds_tenant_read on public.beds;
create policy beds_tenant_read on public.beds
  for select using (pg_id = public.current_pg_id());

drop policy if exists beds_super_read on public.beds;
create policy beds_super_read on public.beds
  for select using (public.current_role() = 'super_admin');
