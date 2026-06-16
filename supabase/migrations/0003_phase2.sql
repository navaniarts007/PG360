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
