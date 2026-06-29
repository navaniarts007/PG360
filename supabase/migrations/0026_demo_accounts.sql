-- =============================================================================
-- PG360 · 0026_demo_accounts.sql — demo / trial PG accounts.
-- A demo account is a time-limited trial: excluded from revenue, shown a
-- countdown to its owner, and blocked once the trial ends. subscription_expiry
-- doubles as the trial end date for demo accounts. Additive + idempotent.
-- =============================================================================

alter table public.pg_accounts
  add column if not exists is_demo boolean not null default false;
