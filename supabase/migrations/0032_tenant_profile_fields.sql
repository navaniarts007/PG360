-- ---------------------------------------------------------------------------
-- 0032 — optional tenant profile fields: address + occupation (student/working)
-- and the institute/company name.
-- ---------------------------------------------------------------------------
alter table public.tenants
  add column if not exists address text,
  add column if not exists occupation text,
  add column if not exists organization text;
