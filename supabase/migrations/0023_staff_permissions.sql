-- =============================================================================
-- PG360 · 0023_staff_permissions.sql — per-staff privileges.
-- Owners grant each staff member module access + edit/delete rights. Stored as
-- JSONB on the profile: { "modules": [...], "edit": bool, "delete": bool }.
-- NULL = full access (owners, and any pre-existing staff — nothing breaks).
-- Enforced in the app (UI + server actions); RLS stays the coarse pg boundary.
-- Additive + idempotent.
-- =============================================================================

alter table public.profiles
  add column if not exists permissions jsonb;
