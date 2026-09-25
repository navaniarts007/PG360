-- ===== 0001_schema.sql =====
-- =============================================================================
-- PG360 · 0001_schema.sql
-- Core schema for the multi-tenant PG management platform.
-- Money is stored as integer rupees. Timestamps are timestamptz (Asia/Kolkata
-- in the UI). Every PG-scoped table carries pg_id. RLS is added in 0002_rls.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles : maps each auth user to a role + pg. The security backbone.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null check (role in ('super_admin', 'admin', 'staff', 'tenant')),
  pg_id       uuid,                       -- null only for super_admin
  full_name   text not null,
  phone       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pg_accounts : one row per PG (the tenant boundary of the SaaS).
-- ---------------------------------------------------------------------------
create table if not exists public.pg_accounts (
  id                  uuid primary key default gen_random_uuid(),
  owner_name          text not null,
  pg_name             text not null,
  mobile              text not null,
  location            text not null,
  pg_type             text not null check (pg_type in ('boys', 'girls', 'coliving')),
  category            text not null check (category in ('budget', 'standard', 'premium')),
  status              text not null default 'active' check (status in ('active', 'suspended')),
  subscription_plan   text not null check (subscription_plan in ('monthly', 'yearly', 'lifetime')),
  subscription_expiry date,
  created_by          uuid references public.profiles (id),
  created_at          timestamptz not null default now()
);

-- profiles.pg_id references pg_accounts (added after pg_accounts exists)
alter table public.profiles
  drop constraint if exists profiles_pg_id_fkey;
alter table public.profiles
  add constraint profiles_pg_id_fkey
  foreign key (pg_id) references public.pg_accounts (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  pg_id         uuid not null references public.pg_accounts (id) on delete cascade,
  room_number   text not null,
  floor         int  not null default 0,
  type          text not null check (type in ('single', 'double', 'triple')),
  total_beds    int  not null check (total_beds > 0),
  occupied_beds int  not null default 0 check (occupied_beds >= 0),
  rent_amount   int  not null default 0,
  wifi_password text not null default '',
  amenities     text[] not null default '{}',
  status        text not null default 'vacant' check (status in ('vacant', 'partial', 'occupied')),
  created_at    timestamptz not null default now(),
  unique (pg_id, room_number)
);

-- ---------------------------------------------------------------------------
-- tenants : a resident. user_id links to their auth login (nullable until set).
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id                uuid primary key default gen_random_uuid(),
  pg_id             uuid not null references public.pg_accounts (id) on delete cascade,
  room_id           uuid references public.rooms (id) on delete set null,
  user_id           uuid references auth.users (id) on delete set null,
  name              text not null,
  phone             text not null,
  email             text,
  aadhaar_number    text,
  aadhaar_photo_url text,
  emergency_contact text,
  rent_amount       int  not null default 0,
  security_deposit  int  not null default 0,
  checkin_date      date not null default current_date,
  checkout_date     date,
  rent_due_day      int  not null default 5 check (rent_due_day between 1 and 28),
  food_plan_active  boolean not null default false,
  status            text not null default 'active' check (status in ('active', 'checked_out')),
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- payments : one bill per tenant per month.
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id                    uuid primary key default gen_random_uuid(),
  pg_id                 uuid not null references public.pg_accounts (id) on delete cascade,
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  month_for             text not null,  -- 'YYYY-MM'
  base_rent             int  not null default 0,
  electricity_charge    int  not null default 0,
  food_charge           int  not null default 0,
  other_charges         int  not null default 0,
  total_amount          int  not null default 0,
  amount_paid           int  not null default 0,
  payment_mode          text check (payment_mode in ('cash', 'upi', 'bank')),
  payment_screenshot_url text,
  payment_date          date,
  status                text not null default 'due' check (status in ('paid', 'partial', 'due')),
  notes                 text,
  created_at            timestamptz not null default now(),
  unique (tenant_id, month_for)
);

-- ---------------------------------------------------------------------------
-- issues : tenant complaints.
-- ---------------------------------------------------------------------------
create table if not exists public.issues (
  id          uuid primary key default gen_random_uuid(),
  pg_id       uuid not null references public.pg_accounts (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  category    text not null check (category in ('electricity','plumbing','wifi','cleaning','noise','other')),
  description text not null,
  photo_url   text,
  status      text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  assigned_to uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Indexes for the hot pg-scoped lookups.
-- ---------------------------------------------------------------------------
create index if not exists idx_rooms_pg      on public.rooms (pg_id);
create index if not exists idx_tenants_pg    on public.tenants (pg_id);
create index if not exists idx_tenants_user  on public.tenants (user_id);
create index if not exists idx_payments_pg   on public.payments (pg_id);
create index if not exists idx_payments_t    on public.payments (tenant_id);
create index if not exists idx_issues_pg     on public.issues (pg_id);
create index if not exists idx_issues_tenant on public.issues (tenant_id);

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS policies (read role/pg from the caller's profile).
-- SECURITY DEFINER so they can read profiles without recursive RLS.
-- ---------------------------------------------------------------------------
create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_pg_id()
returns uuid language sql stable security definer set search_path = public as $$
  select pg_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.tenants where user_id = auth.uid() limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: derive room.status from occupied_beds / total_beds.
-- ---------------------------------------------------------------------------
create or replace function public.derive_room_status()
returns trigger language plpgsql as $$
begin
  if new.occupied_beds <= 0 then
    new.status := 'vacant';
  elsif new.occupied_beds >= new.total_beds then
    new.status := 'occupied';
  else
    new.status := 'partial';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_room_status on public.rooms;
create trigger trg_room_status
  before insert or update of occupied_beds, total_beds on public.rooms
  for each row execute function public.derive_room_status();

-- ---------------------------------------------------------------------------
-- Trigger: derive payment.total_amount + status from the charge breakdown.
-- ---------------------------------------------------------------------------
create or replace function public.derive_payment_status()
returns trigger language plpgsql as $$
begin
  new.total_amount := coalesce(new.base_rent,0) + coalesce(new.electricity_charge,0)
                    + coalesce(new.food_charge,0) + coalesce(new.other_charges,0);
  if new.amount_paid >= new.total_amount and new.total_amount > 0 then
    new.status := 'paid';
  elsif new.amount_paid > 0 then
    new.status := 'partial';
  else
    new.status := 'due';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_status on public.payments;
create trigger trg_payment_status
  before insert or update on public.payments
  for each row execute function public.derive_payment_status();


-- ===== 0002_rls.sql =====
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


-- ===== 0003_phase2.sql =====
-- =============================================================================
-- PG360 · 0003_phase2.sql  — "Sellable" tables: bookings, food, expenses,
-- notifications. Every table is pg-scoped and RLS-protected, like Phase 1.
-- =============================================================================

-- ------------------------------------------------------------------ bookings
create table if not exists public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  pg_id               uuid not null references public.pg_accounts (id) on delete cascade,
  tenant_name         text not null,
  phone               text not null,
  preferred_room_type text not null check (preferred_room_type in ('single','double','triple','any')),
  requested_date      date,
  status              text not null default 'pending' check (status in ('pending','approved','rejected')),
  notes               text,
  created_at          timestamptz not null default now()
);
create index if not exists idx_bookings_pg on public.bookings (pg_id);

-- ----------------------------------------------------------------- food_menu
create table if not exists public.food_menu (
  id          uuid primary key default gen_random_uuid(),
  pg_id       uuid not null references public.pg_accounts (id) on delete cascade,
  day_of_week int  not null check (day_of_week between 0 and 6),  -- 0=Mon .. 6=Sun
  meal_type   text not null check (meal_type in ('breakfast','lunch','dinner')),
  description text not null default '',
  created_at  timestamptz not null default now(),
  unique (pg_id, day_of_week, meal_type)
);
create index if not exists idx_food_menu_pg on public.food_menu (pg_id);

-- ------------------------------------------------------------------ food_opt
create table if not exists public.food_opt (
  id        uuid primary key default gen_random_uuid(),
  pg_id     uuid not null references public.pg_accounts (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  date      date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner')),
  opted_in  boolean not null default true,
  unique (tenant_id, date, meal_type)
);
create index if not exists idx_food_opt_tenant on public.food_opt (tenant_id);

-- ------------------------------------------------------------------ expenses
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  pg_id       uuid not null references public.pg_accounts (id) on delete cascade,
  category    text not null check (category in
              ('rent','salaries','utilities','groceries','maintenance','supplies','marketing','other')),
  amount      int  not null check (amount >= 0),
  date        date not null default current_date,
  description text,
  added_by    uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_expenses_pg on public.expenses (pg_id);

-- ------------------------------------------------------------- notifications
create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  pg_id          uuid not null references public.pg_accounts (id) on delete cascade,
  recipient_id   uuid not null references auth.users (id) on delete cascade,
  recipient_type text not null check (recipient_type in ('admin','staff','tenant')),
  message        text not null,
  link           text,
  is_read        boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_notif_recipient on public.notifications (recipient_id, is_read);

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.bookings      enable row level security;
alter table public.food_menu     enable row level security;
alter table public.food_opt      enable row level security;
alter table public.expenses      enable row level security;
alter table public.notifications enable row level security;

-- bookings: staff manage their PG's inbox. (Public requests are inserted via a
-- trusted server action using the service role, so no anon policy is needed.)
drop policy if exists bookings_staff_all on public.bookings;
create policy bookings_staff_all on public.bookings
  for all
  using (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'))
  with check (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'));

-- food_menu: staff manage; anyone in the PG can read the menu.
drop policy if exists food_menu_staff_all on public.food_menu;
create policy food_menu_staff_all on public.food_menu
  for all
  using (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'))
  with check (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'));

drop policy if exists food_menu_member_read on public.food_menu;
create policy food_menu_member_read on public.food_menu
  for select using (pg_id = public.current_pg_id());

-- food_opt: a tenant manages their own opt-ins; staff read their PG's.
drop policy if exists food_opt_self_all on public.food_opt;
create policy food_opt_self_all on public.food_opt
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id() and pg_id = public.current_pg_id());

drop policy if exists food_opt_staff_read on public.food_opt;
create policy food_opt_staff_read on public.food_opt
  for select
  using (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'));

-- expenses: staff only, scoped to their PG.
drop policy if exists expenses_staff_all on public.expenses;
create policy expenses_staff_all on public.expenses
  for all
  using (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'))
  with check (pg_id = public.current_pg_id() and public.current_role() in ('admin','staff'));

-- notifications: a user reads/updates only their own.
drop policy if exists notif_self_read on public.notifications;
create policy notif_self_read on public.notifications
  for select using (recipient_id = auth.uid());

drop policy if exists notif_self_update on public.notifications;
create policy notif_self_update on public.notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());


-- ===== 0004_realtime.sql =====
-- =============================================================================
-- PG360 · 0004_realtime.sql — enable Supabase Realtime for notifications so the
-- in-app bell updates live. RLS still applies to realtime, so each user only
-- receives rows where recipient_id = auth.uid().
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;


-- ===== 0005_payment_details.sql =====
-- =============================================================================
-- PG360 · 0005_payment_details.sql — per-PG "how to pay" details shown on the
-- tenant bill: UPI id, bank details, and a payment QR image (Cloudinary URL).
-- =============================================================================

alter table public.pg_accounts
  add column if not exists upi_id        text,
  add column if not exists bank_details  text,
  add column if not exists payment_qr_url text;


-- ===== 0006_multiproperty.sql =====
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


-- ===== 0007_beds.sql =====
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


-- ===== 0008_floors.sql =====
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


-- ===== 0009_payment_verify.sql =====
-- =============================================================================
-- PG360 · 0009_payment_verify.sql — owner verification of payments.
-- Tenant-submitted payments start unverified; admin-recorded ones are trusted.
-- =============================================================================

alter table public.payments
  add column if not exists verified boolean not null default false;

-- existing rows (seeded / admin-recorded) are trusted
update public.payments set verified = true where verified = false;


-- ===== 0010_money_model.sql =====
-- =============================================================================
-- PG360 · 0010_money_model.sql — Bangalore redesign, part 2: the money model.
-- Adds: PG policies (notice / lock-in / deposit-months / electricity cap),
-- one-time joining fees, checkout settlements, food-included-by-default + per-
-- tenant opt-out, pro-rata flags on bills, and owner PAN / address for HRA rent
-- receipts. Strictly ADDITIVE + idempotent — existing columns are kept so the
-- current UI keeps working during the transition.
-- =============================================================================

-- ---- pg_accounts: HRA receipt fields + food defaults ------------------------
alter table public.pg_accounts
  add column if not exists owner_pan              text,
  add column if not exists property_address       text,
  add column if not exists food_included_default  boolean not null default true,
  add column if not exists food_opt_out_deduction int not null default 0;

-- ---- tenants: bed-era money fields -----------------------------------------
alter table public.tenants
  add column if not exists food_opt_out      boolean not null default false,
  add column if not exists joining_date      date,
  add column if not exists notice_given_date date,
  add column if not exists lock_in_end_date  date;

-- ---- payments: pro-rata + food opt-out deduction ---------------------------
alter table public.payments
  add column if not exists is_pro_rata            boolean not null default false,
  add column if not exists pro_rata_days          int,
  add column if not exists food_opt_out_deduction int not null default 0;

-- ---- total_amount trigger: subtract the food opt-out deduction --------------
-- (same trigger from 0001 — just extend the formula; existing rows are unchanged
--  because food_opt_out_deduction defaults to 0.)
create or replace function public.derive_payment_status()
returns trigger language plpgsql as $$
begin
  new.total_amount := coalesce(new.base_rent,0) + coalesce(new.electricity_charge,0)
                    + coalesce(new.food_charge,0) + coalesce(new.other_charges,0)
                    - coalesce(new.food_opt_out_deduction,0);
  if new.total_amount < 0 then new.total_amount := 0; end if;
  if new.amount_paid >= new.total_amount and new.total_amount > 0 then
    new.status := 'paid';
  elsif new.amount_paid > 0 then
    new.status := 'partial';
  else
    new.status := 'due';
  end if;
  return new;
end;
$$;

-- ---- pg_policies: one row per property -------------------------------------
create table if not exists public.pg_policies (
  id                         uuid primary key default gen_random_uuid(),
  pg_id                      uuid not null references public.pg_accounts (id) on delete cascade,
  notice_period_days         int not null default 30,
  lock_in_months             int not null default 0,    -- 0 = no lock-in
  deposit_months             int not null default 1,    -- deposit = N × monthly rent
  electricity_included_units int not null default 0,    -- free units / month
  electricity_per_unit_rate  int not null default 0,    -- rate above the cap
  created_at                 timestamptz not null default now(),
  unique (pg_id)
);
create index if not exists idx_pg_policies_pg on public.pg_policies (pg_id);

-- ---- joining_fees: one-time, non-refundable --------------------------------
create table if not exists public.joining_fees (
  id          uuid primary key default gen_random_uuid(),
  pg_id       uuid not null references public.pg_accounts (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  amount      int not null default 0,
  description text not null default 'Admission / Joining Fee',
  paid        boolean not null default false,
  paid_date   date,
  created_at  timestamptz not null default now()
);
create index if not exists idx_joining_fees_pg     on public.joining_fees (pg_id);
create index if not exists idx_joining_fees_tenant on public.joining_fees (tenant_id);

-- ---- checkout_settlements --------------------------------------------------
create table if not exists public.checkout_settlements (
  id                    uuid primary key default gen_random_uuid(),
  pg_id                 uuid not null references public.pg_accounts (id) on delete cascade,
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  checkout_date         date not null,
  last_paid_until       date,
  pro_rata_days_owed    int not null default 0,
  pro_rata_amount       int not null default 0,
  notice_shortfall_days int not null default 0,
  notice_penalty        int not null default 0,
  lock_in_forfeiture    int not null default 0,
  damages_deduction     int not null default 0,
  deposit_amount        int not null default 0,
  refundable_amount     int not null default 0,
  notes                 text,
  status                text not null default 'draft' check (status in ('draft','confirmed','paid')),
  created_at            timestamptz not null default now()
);
create index if not exists idx_checkout_pg     on public.checkout_settlements (pg_id);
create index if not exists idx_checkout_tenant on public.checkout_settlements (tenant_id);

-- =============================================================================
-- RLS: staff manage their properties' rows; tenants read their own; super reads.
-- =============================================================================
alter table public.pg_policies          enable row level security;
alter table public.joining_fees         enable row level security;
alter table public.checkout_settlements enable row level security;

drop policy if exists pg_policies_staff_all on public.pg_policies;
create policy pg_policies_staff_all on public.pg_policies
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists pg_policies_tenant_read on public.pg_policies;
create policy pg_policies_tenant_read on public.pg_policies
  for select using (pg_id = public.current_pg_id());

drop policy if exists pg_policies_super_read on public.pg_policies;
create policy pg_policies_super_read on public.pg_policies
  for select using (public.current_role() = 'super_admin');

drop policy if exists joining_fees_staff_all on public.joining_fees;
create policy joining_fees_staff_all on public.joining_fees
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists joining_fees_tenant_read on public.joining_fees;
create policy joining_fees_tenant_read on public.joining_fees
  for select using (tenant_id = public.current_tenant_id());

drop policy if exists joining_fees_super_read on public.joining_fees;
create policy joining_fees_super_read on public.joining_fees
  for select using (public.current_role() = 'super_admin');

drop policy if exists checkout_staff_all on public.checkout_settlements;
create policy checkout_staff_all on public.checkout_settlements
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists checkout_tenant_read on public.checkout_settlements;
create policy checkout_tenant_read on public.checkout_settlements
  for select using (tenant_id = public.current_tenant_id());

drop policy if exists checkout_super_read on public.checkout_settlements;
create policy checkout_super_read on public.checkout_settlements
  for select using (public.current_role() = 'super_admin');

-- ---- seed a default policy row for every existing property ------------------
insert into public.pg_policies (pg_id)
  select id from public.pg_accounts
  on conflict (pg_id) do nothing;


-- ===== 0011_wifi.sql =====
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


-- ===== 0012_tenant_avatar.sql =====
-- =============================================================================
-- PG360 · 0012_tenant_avatar.sql — tenant profile photo (portal). Stored as a
-- Cloudinary URL; updates go through the service client (same pattern as the
-- food opt-out toggle), so no RLS change is needed. Additive + idempotent.
-- =============================================================================

alter table public.tenants
  add column if not exists avatar_url text;


-- ===== 0013_room_type.sql =====
-- =============================================================================
-- PG360 · 0013_room_type.sql — drop the legacy rooms.type check.
-- Room type now derives from the rate card, whose sharing types include quad +
-- dorm. The old constraint (single/double/triple only) rejected those, so
-- adding a "Four sharing" / "Dormitory" room failed. Type is free text now.
-- Idempotent.
-- =============================================================================

alter table public.rooms drop constraint if exists rooms_type_check;


-- ===== 0014_tenant_records.sql =====
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


-- ===== 0015_account_editions.sql =====
-- =============================================================================
-- PG360 · 0015_account_editions.sql — per-account edition / access control.
-- Moves the white-label "edition" off the host-config map and onto each
-- pg_account, so super-admin can assign edition + portal access + reg-no
-- prefix per client straight from the platform panel (no code/deploy).
-- Additive + idempotent.
-- =============================================================================

alter table public.pg_accounts
  add column if not exists edition        text    not null default 'full',
  add column if not exists portal_enabled boolean not null default true,
  add column if not exists reg_prefix     text;

-- constrain edition to the known set (drop+recreate so it stays idempotent)
alter table public.pg_accounts
  drop constraint if exists pg_accounts_edition_check;
alter table public.pg_accounts
  add constraint pg_accounts_edition_check check (edition in ('full', 'gvm'));

-- ---- backfill the existing GVR Comforts client ------------------------------
update public.pg_accounts
   set edition        = 'gvm',
       portal_enabled = false,
       reg_prefix     = coalesce(reg_prefix, 'GVR')
 where edition <> 'gvm'
   and (pg_name ilike '%gvr%' or pg_name ilike '%gvm%');


-- ===== 0016_super_admin_manage.sql =====
-- =============================================================================
-- PG360 · 0016_super_admin_manage.sql — super-admin "open / manage a PG".
-- Today super_admin can only SELECT pg-scoped data. To let the platform owner
-- enter a PG and manage it (impersonation), grant super_admin full DML on every
-- pg-scoped table. The app still scopes writes to the impersonated property;
-- everyone else stays bound by their existing policies.
-- Idempotent — generated from any table carrying a pg_id column.
-- =============================================================================

do $$
declare t text;
begin
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tb
        on tb.table_schema = 'public'
       and tb.table_name = c.table_name
       and tb.table_type = 'BASE TABLE'
     where c.table_schema = 'public'
       and c.column_name = 'pg_id'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_super_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (public.current_role() = ''super_admin'') '
      || 'with check (public.current_role() = ''super_admin'')',
      t || '_super_all', t);
  end loop;
end $$;

-- property_members keys on property_id (not pg_id) — cover it explicitly.
drop policy if exists property_members_super_all on public.property_members;
create policy property_members_super_all on public.property_members
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');


-- ===== 0017_billing_terms.sql =====
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


-- ===== 0018_invoice_cycle.sql =====
-- =============================================================================
-- PG360 · 0018_invoice_cycle.sql — invoice billing cycle.
-- One-time / monthly / yearly, shown on the printed invoice. Additive.
-- =============================================================================

alter table public.platform_invoices
  add column if not exists billing_cycle text not null default 'one_time';

alter table public.platform_invoices
  drop constraint if exists platform_invoices_cycle_check;
alter table public.platform_invoices
  add constraint platform_invoices_cycle_check
  check (billing_cycle in ('one_time', 'monthly', 'yearly'));


-- ===== 0019_kyc_bucket.sql =====
-- =============================================================================
-- PG360 · 0019_kyc_bucket.sql — private storage for Aadhaar / KYC documents.
-- KYC images move off public Cloudinary URLs into a PRIVATE Supabase Storage
-- bucket (Mumbai region) served only via short-lived signed URLs generated
-- server-side. No public policies — all access goes through the service role,
-- so the files are never publicly reachable. Idempotent.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('kyc', 'kyc', false)
on conflict (id) do update set public = false;


-- ===== 0020_stay_type.sql =====
-- =============================================================================
-- PG360 · 0020_stay_type.sql — monthly vs day-wise stays.
-- Some guests stay a fixed number of days (15, 70…) rather than month-to-month.
-- A day-wise tenant is billed ONCE for the whole stay: daily_rate * stay_days.
-- Monthly tenants are unchanged (stay_type defaults to 'monthly').
-- Additive + idempotent.
-- =============================================================================

alter table public.tenants
  add column if not exists stay_type  text not null default 'monthly',
  add column if not exists daily_rate numeric,
  add column if not exists stay_days  int;

alter table public.tenants drop constraint if exists tenants_stay_type_check;
alter table public.tenants
  add constraint tenants_stay_type_check check (stay_type in ('monthly', 'daily'));


-- ===== 0021_agreements.sql =====
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


-- ===== 0022_tenant_documents.sql =====
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


-- ===== 0023_staff_permissions.sql =====
-- =============================================================================
-- PG360 · 0023_staff_permissions.sql — per-staff privileges.
-- Owners grant each staff member module access + edit/delete rights. Stored as
-- JSONB on the profile: { "modules": [...], "edit": bool, "delete": bool }.
-- NULL = full access (owners, and any pre-existing staff — nothing breaks).
-- Enforced in the app (UI + server actions); RLS stays the coarse pg boundary.
-- Additive + idempotent.
-- =============================================================================

alter table public.profiles
  add column if not exists permissions jsonb;


-- ===== 0024_activity_log.sql =====
-- =============================================================================
-- PG360 · 0024_activity_log.sql — audit / activity log.
-- Records significant actions (who did what) for owners (their property) and
-- super-admin (platform-wide). pg_id null = a platform-level event. actor_* are
-- denormalised (no FK) so the log survives even if the user/pg is removed.
-- Writes go through the service client; reads are RLS-scoped. Idempotent.
-- =============================================================================

create table if not exists public.activity_log (
  id         uuid primary key default gen_random_uuid(),
  pg_id      uuid references public.pg_accounts (id) on delete cascade,
  actor_id   uuid,
  actor_name text,
  actor_role text,
  action     text not null,
  detail     text,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_pg on public.activity_log (pg_id, created_at desc);
create index if not exists idx_activity_created on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;

drop policy if exists activity_staff_read on public.activity_log;
create policy activity_staff_read on public.activity_log
  for select
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists activity_super_read on public.activity_log;
create policy activity_super_read on public.activity_log
  for select using (public.current_role() = 'super_admin');


-- ===== 0025_platform_usage.sql =====
-- =============================================================================
-- PG360 · 0025_platform_usage.sql — live Supabase usage snapshot for the
-- super-admin dashboard. SECURITY DEFINER so it can read db size / auth /
-- storage, but it returns data only to a super_admin caller. Idempotent.
-- =============================================================================

create or replace function public.platform_usage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if public.current_role() <> 'super_admin' then
    return '{}'::jsonb;
  end if;
  select jsonb_build_object(
    'db_bytes',        pg_database_size(current_database()),
    'auth_users',      (select count(*) from auth.users),
    'storage_objects', (select count(*) from storage.objects),
    'storage_bytes',   (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
    'pg_count',        (select count(*) from public.pg_accounts),
    'tenant_count',    (select count(*) from public.tenants),
    'payment_count',   (select count(*) from public.payments),
    'activity_count',  (select count(*) from public.activity_log)
  ) into result;
  return result;
end $$;

grant execute on function public.platform_usage() to authenticated;


-- ===== 0026_demo_accounts.sql =====
-- =============================================================================
-- PG360 · 0026_demo_accounts.sql — demo / trial PG accounts.
-- A demo account is a time-limited trial: excluded from revenue, shown a
-- countdown to its owner, and blocked once the trial ends. subscription_expiry
-- doubles as the trial end date for demo accounts. Additive + idempotent.
-- =============================================================================

alter table public.pg_accounts
  add column if not exists is_demo boolean not null default false;


-- ===== 0027_payment_lineitems.sql =====
-- ---------------------------------------------------------------------------
-- 0027 — record security deposit + joining fee as first-class payment line
-- items, so a single recorded payment can collect rent + deposit + admission
-- fee together and the bill/receipt shows the full breakdown.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists security_deposit int not null default 0,
  add column if not exists joining_fee       int not null default 0;

-- Fold the two new line items into the derived total.
create or replace function public.derive_payment_status()
returns trigger language plpgsql as $$
begin
  new.total_amount := coalesce(new.base_rent,0) + coalesce(new.electricity_charge,0)
                    + coalesce(new.food_charge,0) + coalesce(new.other_charges,0)
                    + coalesce(new.security_deposit,0) + coalesce(new.joining_fee,0);
  if new.amount_paid >= new.total_amount and new.total_amount > 0 then
    new.status := 'paid';
  elsif new.amount_paid > 0 then
    new.status := 'partial';
  else
    new.status := 'due';
  end if;
  return new;
end;
$$;


-- ===== 0028_expense_categories.sql =====
-- ---------------------------------------------------------------------------
-- 0028 — custom expense categories. Owners can define their own expense
-- categories (a per-property "master") instead of the fixed 8-value list.
-- ---------------------------------------------------------------------------

-- The category column was a hard CHECK enum; relax it to free text so custom
-- categories validate. (App still offers the built-in defaults.)
alter table public.expenses drop constraint if exists expenses_category_check;

create table if not exists public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  pg_id       uuid not null references public.pg_accounts (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (pg_id, name)
);
create index if not exists idx_expense_categories_pg on public.expense_categories (pg_id);

alter table public.expense_categories enable row level security;

drop policy if exists expense_categories_staff_all on public.expense_categories;
create policy expense_categories_staff_all on public.expense_categories
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists expense_categories_super_all on public.expense_categories;
create policy expense_categories_super_all on public.expense_categories
  for all
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');


-- ===== 0029_expense_subcategories.sql =====
-- ---------------------------------------------------------------------------
-- 0029 — sub-categories for expenses. An expense_categories row is a top-level
-- category when parent = '', or a sub-category of `parent` otherwise. Works for
-- both built-in defaults (parent = 'utilities') and custom categories.
-- ---------------------------------------------------------------------------
alter table public.expense_categories
  add column if not exists parent text not null default '';

-- widen the uniqueness to (pg, parent, name) so the same sub-name can live under
-- different parents.
alter table public.expense_categories
  drop constraint if exists expense_categories_pg_id_name_key;
create unique index if not exists uq_expense_categories_pg_parent_name
  on public.expense_categories (pg_id, parent, name);

-- expenses carry an optional sub-category label alongside the category.
alter table public.expenses
  add column if not exists subcategory text;


-- ===== 0030_settlement_advance.sql =====
-- ---------------------------------------------------------------------------
-- 0030 — advance credit on checkout settlements. A tenant-paid advance that is
-- either refunded (if they're paid up) or adjusted against dues at vacating.
-- ---------------------------------------------------------------------------
alter table public.checkout_settlements
  add column if not exists advance_amount int not null default 0;


-- ===== 0031_tenant_parent_phone.sql =====
-- ---------------------------------------------------------------------------
-- 0031 — optional guardian / parent contact number on a tenant.
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists parent_phone text;


-- ===== 0032_tenant_profile_fields.sql =====
-- ---------------------------------------------------------------------------
-- 0032 — optional tenant profile fields: address + occupation (student/working)
-- and the institute/company name.
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists address text,
  add column if not exists occupation text,
  add column if not exists organization text;


-- ===== 0033_tenant_parents.sql =====
-- ---------------------------------------------------------------------------
-- 0033 — optional father / mother name on a tenant.
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists father_name text,
  add column if not exists mother_name text;


-- ===== 0034_tenant_guardian.sql =====
-- 0034 — single free-text guardian/friend contact (name + number) on a tenant.
alter table public.tenants
  add column if not exists guardian text;


-- ===== 0035_tenant_vehicle.sql =====
-- 0035 — optional vehicle number on a tenant.
alter table public.tenants
  add column if not exists vehicle_number text;


-- ===== 0036_renewal_checks.sql =====
-- =============================================================================
-- PG360 · 0036_renewal_checks.sql — 30-day stay-cycle renewal tracking.
-- Every tenant runs on a rolling 30-day cycle anchored on their check-in date.
-- 3 days before each cycle completes the app flags the tenant so staff confirm
-- whether they extend or vacate. One row per (tenant, cycle end): created when
-- the alert notification fires, resolved when staff record the decision.
-- Additive + idempotent.
-- =============================================================================

create table if not exists public.renewal_checks (
  id          uuid primary key default gen_random_uuid(),
  pg_id       uuid not null references public.pg_accounts (id) on delete cascade,
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  cycle_end   date not null,
  decision    text check (decision in ('extend', 'vacate')),
  decided_at  timestamptz,
  decided_by  uuid,
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (tenant_id, cycle_end)
);
create index if not exists idx_renewal_checks_pg on public.renewal_checks (pg_id);

-- ---- RLS: staff manage their properties' checks; super reads ----------------
alter table public.renewal_checks enable row level security;

drop policy if exists renewal_checks_staff_all on public.renewal_checks;
create policy renewal_checks_staff_all on public.renewal_checks
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists renewal_checks_super_read on public.renewal_checks;
create policy renewal_checks_super_read on public.renewal_checks
  for select using (public.current_role() = 'super_admin');


-- ===== 0037_subscription_plans.sql =====
-- Rename PG billing plans from starter/pro to monthly/yearly.
update public.pg_accounts
set subscription_plan = 'monthly'
where subscription_plan = 'starter';

update public.pg_accounts
set subscription_plan = 'yearly'
where subscription_plan = 'pro';

alter table public.pg_accounts
  drop constraint if exists pg_accounts_subscription_plan_check;

alter table public.pg_accounts
  add constraint pg_accounts_subscription_plan_check
  check (subscription_plan in ('monthly', 'yearly', 'lifetime'));

-- ===== 0038_rules_document.sql =====
-- =============================================================================
-- PG360 · 0038_rules_document.sql — Rules & Regulations document upload for PG.
-- Allows admin to upload a Rules & Regulations document (PDF / doc / image) for the PG.
-- Additive + idempotent.
-- =============================================================================

alter table public.pg_accounts
  add column if not exists rules_doc_url text;


