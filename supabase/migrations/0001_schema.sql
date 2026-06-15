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
  subscription_plan   text not null check (subscription_plan in ('starter', 'pro', 'lifetime')),
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
