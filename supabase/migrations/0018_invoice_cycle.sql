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
