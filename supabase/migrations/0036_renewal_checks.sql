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
