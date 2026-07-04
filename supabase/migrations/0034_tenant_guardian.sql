-- 0034 — single free-text guardian/friend contact (name + number) on a tenant.
alter table public.tenants
  add column if not exists guardian text;
