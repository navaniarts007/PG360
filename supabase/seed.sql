-- =============================================================================
-- PG360 · seed.sql  (domain data)
-- Mirrors the in-app DEMO seed so a fresh Supabase project has something to show.
-- NOTE: auth users + profiles are created via Auth (see scripts/seed.mjs or the
-- Supabase dashboard). This file seeds only the business tables, which is enough
-- to view data with RLS temporarily disabled or as the service role.
-- =============================================================================

insert into public.pg_accounts (id, owner_name, pg_name, mobile, location, pg_type, category, status, subscription_plan, subscription_expiry)
values
  ('11111111-1111-1111-1111-111111111111', 'Ravi Kumar',  'Sunrise Stay',      '+919845012345', 'Koramangala, Bengaluru', 'coliving', 'premium',  'active',    'pro',     '2027-04-01'),
  ('22222222-2222-2222-2222-222222222222', 'Meena Iyer',  'Green Nest Hostel', '+919812233445', 'HSR Layout, Bengaluru',  'girls',    'standard', 'active',    'starter', '2026-12-01'),
  ('33333333-3333-3333-3333-333333333333', 'Imran Shaikh','Metro Boys PG',     '+919900110022', 'Andheri East, Mumbai',   'boys',     'budget',   'suspended', 'starter', '2026-02-01')
on conflict (id) do nothing;

insert into public.rooms (id, pg_id, room_number, floor, type, total_beds, occupied_beds, rent_amount, wifi_password, amenities)
values
  ('aaaa0101-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '101', 1, 'double', 2, 2, 12000, 'Sunrise@101', '{AC,"Attached bath",Geyser,"Study table"}'),
  ('aaaa0102-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '102', 1, 'triple', 3, 2,  9000, 'Sunrise@102', '{Fan,"Common bath",Wardrobe}'),
  ('aaaa0201-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '201', 2, 'single', 1, 1, 16000, 'Sunrise@201', '{AC,"Attached bath",Balcony,"Smart TV"}'),
  ('aaaa0301-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', '301', 3, 'triple', 3, 3,  8500, 'Sunrise@301', '{Fan,"Common bath",Wardrobe}')
on conflict (id) do nothing;

insert into public.tenants (id, pg_id, room_id, name, phone, email, aadhaar_number, rent_amount, security_deposit, checkin_date, rent_due_day, food_plan_active, status)
values
  ('bbbb0001-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0201-0000-0000-0000-000000000000', 'Arjun Nair',   '+919812000001', 'arjun@tenant.in',  'XXXX-XXXX-4471', 16000, 32000, '2025-04-10', 5, true,  'active'),
  ('bbbb0002-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0101-0000-0000-0000-000000000000', 'Priya Sharma', '+919812000002', 'priya@tenant.in',  'XXXX-XXXX-1182', 12000, 24000, '2025-05-01', 5, true,  'active'),
  ('bbbb0003-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'aaaa0301-0000-0000-0000-000000000000', 'Rahul Das',    '+919812000007', 'rahul@tenant.in',  'XXXX-XXXX-6601',  8500, 17000, '2025-04-22', 5, true,  'active')
on conflict (id) do nothing;

insert into public.payments (id, pg_id, tenant_id, month_for, base_rent, electricity_charge, food_charge, other_charges, amount_paid, payment_mode, payment_date)
values
  ('cccc0001-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'bbbb0001-0000-0000-0000-000000000000', '2026-06', 16000, 850, 3000, 0, 19850, 'upi',  '2026-06-04'),
  ('cccc0002-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'bbbb0002-0000-0000-0000-000000000000', '2026-06', 12000, 600, 3000, 0, 15600, 'upi',  '2026-06-03'),
  ('cccc0003-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'bbbb0003-0000-0000-0000-000000000000', '2026-06',  8500, 450, 3000, 0,     0, null,   null)
on conflict (id) do nothing;

insert into public.issues (id, pg_id, tenant_id, category, description, status)
values
  ('dddd0001-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'bbbb0001-0000-0000-0000-000000000000', 'wifi',     'WiFi keeps dropping every evening on the 2nd floor.', 'in_progress'),
  ('dddd0002-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'bbbb0003-0000-0000-0000-000000000000', 'electricity', 'Tube light in 301 flickers and one socket is dead.', 'resolved')
on conflict (id) do nothing;
