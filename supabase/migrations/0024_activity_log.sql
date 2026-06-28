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
