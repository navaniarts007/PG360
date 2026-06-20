-- =============================================================================
-- PG360 · 0011_wifi.sql — WiFi master. Owners keep a list of WiFi networks per
-- property; rooms pick one from a dropdown instead of re-typing the password.
-- Rooms keep a denormalised wifi_password / wifi_ssid copy (so all existing
-- display code keeps working); editing a network propagates to its rooms.
-- Additive + idempotent.
-- =============================================================================

create table if not exists public.wifi_networks (
  id         uuid primary key default gen_random_uuid(),
  pg_id      uuid not null references public.pg_accounts (id) on delete cascade,
  ssid       text not null,
  password   text not null default '',
  created_at timestamptz not null default now(),
  unique (pg_id, ssid)
);
create index if not exists idx_wifi_networks_pg on public.wifi_networks (pg_id);

alter table public.rooms
  add column if not exists wifi_network_id uuid references public.wifi_networks (id) on delete set null,
  add column if not exists wifi_ssid       text;

-- ---- RLS: staff manage their properties' networks; super reads -------------
alter table public.wifi_networks enable row level security;

drop policy if exists wifi_networks_staff_all on public.wifi_networks;
create policy wifi_networks_staff_all on public.wifi_networks
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists wifi_networks_super_read on public.wifi_networks;
create policy wifi_networks_super_read on public.wifi_networks
  for select using (public.current_role() = 'super_admin');
