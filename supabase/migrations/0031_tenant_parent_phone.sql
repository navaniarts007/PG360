-- ---------------------------------------------------------------------------
-- 0031 — optional guardian / parent contact number on a tenant.
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists parent_phone text;
