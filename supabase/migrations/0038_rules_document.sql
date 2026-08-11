-- =============================================================================
-- PG360 · 0038_rules_document.sql — Rules & Regulations document upload for PG.
-- Allows admin to upload a Rules & Regulations document (PDF / doc / image) for the PG.
-- Additive + idempotent.
-- =============================================================================

alter table public.pg_accounts
  add column if not exists rules_doc_url text;
