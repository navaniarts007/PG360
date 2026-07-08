-- 0035 — optional vehicle number on a tenant.
alter table public.tenants
  add column if not exists vehicle_number text;
