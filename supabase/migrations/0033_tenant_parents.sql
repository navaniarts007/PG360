-- ---------------------------------------------------------------------------
-- 0033 — optional father / mother name on a tenant.
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists father_name text,
  add column if not exists mother_name text;
