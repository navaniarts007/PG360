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
