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
