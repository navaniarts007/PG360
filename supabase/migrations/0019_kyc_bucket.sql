-- =============================================================================
-- PG360 · 0019_kyc_bucket.sql — private storage for Aadhaar / KYC documents.
-- KYC images move off public Cloudinary URLs into a PRIVATE Supabase Storage
-- bucket (Mumbai region) served only via short-lived signed URLs generated
-- server-side. No public policies — all access goes through the service role,
-- so the files are never publicly reachable. Idempotent.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('kyc', 'kyc', false)
on conflict (id) do update set public = false;
