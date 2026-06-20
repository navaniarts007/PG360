-- =============================================================================
-- PG360 · 0012_tenant_avatar.sql — tenant profile photo (portal). Stored as a
-- Cloudinary URL; updates go through the service client (same pattern as the
-- food opt-out toggle), so no RLS change is needed. Additive + idempotent.
-- =============================================================================

alter table public.tenants
  add column if not exists avatar_url text;
