-- ---------------------------------------------------------------------------
-- 0030 — advance credit on checkout settlements. A tenant-paid advance that is
-- either refunded (if they're paid up) or adjusted against dues at vacating.
-- ---------------------------------------------------------------------------
alter table public.checkout_settlements
  add column if not exists advance_amount int not null default 0;
