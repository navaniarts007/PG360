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
