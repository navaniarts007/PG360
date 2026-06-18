-- =============================================================================
-- PG360 · 0009_payment_verify.sql — owner verification of payments.
-- Tenant-submitted payments start unverified; admin-recorded ones are trusted.
-- =============================================================================

alter table public.payments
  add column if not exists verified boolean not null default false;

-- existing rows (seeded / admin-recorded) are trusted
update public.payments set verified = true where verified = false;
