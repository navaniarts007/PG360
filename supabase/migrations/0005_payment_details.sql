-- =============================================================================
-- PG360 · 0005_payment_details.sql — per-PG "how to pay" details shown on the
-- tenant bill: UPI id, bank details, and a payment QR image (Cloudinary URL).
-- =============================================================================

alter table public.pg_accounts
  add column if not exists upi_id        text,
  add column if not exists bank_details  text,
  add column if not exists payment_qr_url text;
