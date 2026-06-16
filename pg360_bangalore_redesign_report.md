# PG360 — Bangalore Billing & Beds Redesign Report

**Date:** 16 June 2026 | **Status:** Critical Architecture Fix Before More Building  
**Verdict:** Foundation is 70% right. Bed model + money model need a focused redesign. This document defines the fix.

---

## The Core Problem in One Line

> PG360 currently thinks in **rooms**. Bangalore PGs sell **beds**.  
> Fix the model now, before it costs 3× more to fix later.

---

## Part 1: The Two Root Cause Fixes

### Fix #1 — Introduce a `beds` Table (Most Critical)

**Current (Wrong):**
```
rooms
 └── rent_amount (one price for whole room)
 └── occupied_beds (just a number counter: 0, 1, 2, 3)
```
There is no bed entity. No bed number. No per-bed price. Tenant rent is hand-typed every time.

**Correct (Bangalore Reality):**
```
rooms
 └── room_type: "double-sharing-AC" | "triple-non-AC" | "single-AC"
 └── total_beds: 3

beds  (new table)
 └── bed_number: "B-101-1", "B-101-2", "B-101-3"
 └── room_id → rooms
 └── price_per_month (derived from rate card)
 └── status: 'vacant' | 'occupied'
 └── current_tenant_id → tenants
 └── available_from: date (when does this bed open up?)

rate_card  (new table)
 └── pg_id
 └── room_type: "double-sharing-AC"
 └── price_per_month: 12000
 └── is_food_included: true
```

When a tenant is added → admin picks a **bed**, not a room. Rent auto-fills from the rate card. No free-typing.

### Fix #2 — Remodel the Money (Billing) Logic

**Current invoice:** `base_rent + electricity + food + other` — generic apartment logic.

**Bangalore PG invoice must support:**

| Charge | What it is | Current Support |
|--------|-----------|----------------|
| Base Rent | Per bed, from rate card | ❌ Hand-typed |
| Joining/Admission Fee | Non-refundable, paid once | ❌ Missing |
| Refundable Deposit | Usually 1–2 months rent | ⚠️ Exists but no months-based calc |
| Pro-rata First Month | Join on 18th → pay 13 days only | ❌ Missing |
| Electricity | Included up to cap, then per-unit | ⚠️ Flat charge only |
| Food Opt-Out Deduction | Food included by default; opt-out = deduct | ⚠️ Inverted (opt-in by default) |
| HRA Rent Receipt | PDF with owner PAN — IT employees need this | ❌ Missing entirely |
| Notice Period / Lock-In | 1 month notice; leave early → forfeit deposit | ❌ Missing |
| Checkout Settlement | Final bill = dues + damages − refund deposit | ⚠️ Only basic deposit deduction |

---

## Part 2: New Supabase Schema (Bangalore-Correct)

### Drop / Replace These Columns

```sql
-- REMOVE from rooms:
rooms.rent_amount          -- replaced by rate_card
rooms.occupied_beds        -- replaced by bed-level status

-- REMOVE from tenants:
tenants.rent_amount        -- now derives from beds.price_per_month
tenants.food_plan_active   -- now property-level flag (food included by default)

-- REMOVE from payments:
payments.food_charge       -- recalculated based on food_included + opt-out
```

### New Tables to Add

```sql
-- RATE CARD (price per bed by room type)
CREATE TABLE rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pg_id uuid REFERENCES pg_accounts(id),
  room_type text NOT NULL,         -- 'single-AC' | 'double-AC' | 'triple-non-AC' | 'dorm'
  ac_type text,                    -- 'AC' | 'non-AC'
  bath_type text,                  -- 'attached' | 'common'
  price_per_month numeric NOT NULL,
  food_included boolean DEFAULT true,
  food_opt_out_deduction numeric DEFAULT 0,  -- amount deducted if tenant opts out
  created_at timestamp DEFAULT now()
);

-- BEDS (individual bed entity)
CREATE TABLE beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pg_id uuid REFERENCES pg_accounts(id),
  room_id uuid REFERENCES rooms(id),
  bed_number text NOT NULL,        -- 'B-101-1', 'B-101-2'
  rate_card_id uuid REFERENCES rate_cards(id),
  price_per_month numeric,         -- copied from rate_card at time of setup
  status text DEFAULT 'vacant',    -- 'vacant' | 'occupied'
  current_tenant_id uuid REFERENCES tenants(id),
  available_from date,             -- useful for advance vacancy planning
  notes text,
  created_at timestamp DEFAULT now()
);

-- JOINING FEES (non-refundable, one-time)
CREATE TABLE joining_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pg_id uuid REFERENCES pg_accounts(id),
  tenant_id uuid REFERENCES tenants(id),
  amount numeric NOT NULL,
  description text DEFAULT 'Admission / Joining Fee',
  paid boolean DEFAULT false,
  paid_date date,
  created_at timestamp DEFAULT now()
);

-- NOTICE PERIOD / LOCK-IN CONFIG (per PG)
CREATE TABLE pg_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pg_id uuid REFERENCES pg_accounts(id),
  notice_period_days integer DEFAULT 30,
  lock_in_months integer DEFAULT 0,    -- 0 = no lock-in
  deposit_months integer DEFAULT 1,    -- deposit = N × monthly rent
  electricity_included_units integer,  -- free units per month (e.g. 50)
  electricity_per_unit_rate numeric,   -- rate above cap
  created_at timestamp DEFAULT now()
);

-- FOOD OPT-OUT LOG (per tenant, per day — for granular tracking)
CREATE TABLE food_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pg_id uuid REFERENCES pg_accounts(id),
  tenant_id uuid REFERENCES tenants(id),
  opt_out_date date NOT NULL,
  meal_type text,   -- 'breakfast' | 'lunch' | 'dinner' | 'all'
  created_at timestamp DEFAULT now()
);

-- HRA RENT RECEIPTS
CREATE TABLE rent_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pg_id uuid REFERENCES pg_accounts(id),
  tenant_id uuid REFERENCES tenants(id),
  payment_id uuid REFERENCES payments(id),
  month_for text,                  -- 'June 2026'
  amount numeric,
  owner_name text,                 -- pulled from pg_accounts
  owner_pan text,                  -- owner enters PAN in settings
  tenant_name text,
  property_address text,
  receipt_number text,             -- auto-generated: RCT-2026-0001
  pdf_url text,                    -- Supabase storage
  generated_at timestamp DEFAULT now()
);

-- CHECKOUT SETTLEMENTS
CREATE TABLE checkout_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pg_id uuid REFERENCES pg_accounts(id),
  tenant_id uuid REFERENCES tenants(id),
  checkout_date date,
  last_paid_until date,
  pro_rata_days_owed integer,
  pro_rata_amount numeric,          -- days × daily rate
  notice_shortfall_days integer,    -- days short of notice period
  notice_penalty numeric,           -- penalty for short notice
  lock_in_forfeiture numeric,       -- if leaving during lock-in
  damages_deduction numeric,
  deposit_amount numeric,
  refundable_amount numeric,        -- deposit - all deductions
  notes text,
  status text DEFAULT 'draft',      -- 'draft' | 'confirmed' | 'paid'
  created_at timestamp DEFAULT now()
);
```

### Update Existing Tables

```sql
-- UPDATE tenants table: add bed reference, remove manual rent
ALTER TABLE tenants
  ADD COLUMN bed_id uuid REFERENCES beds(id),
  ADD COLUMN food_opt_out boolean DEFAULT false,
  ADD COLUMN lock_in_end_date date,
  ADD COLUMN notice_given_date date,
  ADD COLUMN joining_date date;

-- tenant.rent_amount should now be computed:
-- SELECT b.price_per_month FROM beds b WHERE b.current_tenant_id = tenant.id

-- UPDATE pg_accounts table: add owner PAN for HRA receipts
ALTER TABLE pg_accounts
  ADD COLUMN owner_pan text,
  ADD COLUMN property_address text,
  ADD COLUMN food_included_default boolean DEFAULT true;

-- UPDATE payments table: add pro_rata flag
ALTER TABLE payments
  ADD COLUMN is_pro_rata boolean DEFAULT false,
  ADD COLUMN pro_rata_days integer,
  ADD COLUMN food_opt_out_deduction numeric DEFAULT 0;
```

---

## Part 3: Billing Logic (How to Calculate Monthly Invoice)

### Monthly Rent Calculation Function (Pseudo-code)

```javascript
function calculateMonthlyInvoice(tenantId, month) {

  const tenant = getTenant(tenantId);
  const bed = getBed(tenant.bed_id);
  const policy = getPgPolicy(tenant.pg_id);

  // Step 1: Base Rent
  let baseRent = bed.price_per_month;

  // Step 2: Pro-rata (first month only)
  if (isFirstMonth(tenant.checkin_date, month)) {
    const daysInMonth = getDaysInMonth(month);
    const daysStayed = daysInMonth - tenant.checkin_date.getDate() + 1;
    baseRent = (baseRent / daysInMonth) * daysStayed;
    invoice.is_pro_rata = true;
    invoice.pro_rata_days = daysStayed;
  }

  // Step 3: Food deduction (food included by default; opt-out = deduct)
  let foodDeduction = 0;
  if (tenant.food_opt_out) {
    foodDeduction = bed.rate_card.food_opt_out_deduction;
  }

  // Step 4: Electricity
  let electricityCharge = 0;
  if (tenant.electricity_units_used > policy.electricity_included_units) {
    const excessUnits = tenant.electricity_units_used - policy.electricity_included_units;
    electricityCharge = excessUnits * policy.electricity_per_unit_rate;
  }

  // Step 5: Other charges (hand-added extras)
  const otherCharges = getOtherCharges(tenantId, month);

  // Final
  invoice.total = baseRent - foodDeduction + electricityCharge + otherCharges;
  return invoice;
}
```

### Checkout Settlement Calculation

```javascript
function calculateCheckoutSettlement(tenantId, checkoutDate) {

  const tenant = getTenant(tenantId);
  const policy = getPgPolicy(tenant.pg_id);
  const bed = getBed(tenant.bed_id);
  const dailyRate = bed.price_per_month / 30;

  // Pro-rata last month
  const lastPaidUntil = getLastPaidDate(tenantId);
  const daysOwed = daysBetween(lastPaidUntil, checkoutDate);
  const proRataOwed = daysOwed * dailyRate;

  // Notice period check
  const noticeDaysGiven = daysBetween(tenant.notice_given_date, checkoutDate);
  const noticeShortfall = Math.max(0, policy.notice_period_days - noticeDaysGiven);
  const noticePenalty = noticeShortfall * dailyRate;

  // Lock-in check
  let lockInForfeiture = 0;
  if (checkoutDate < tenant.lock_in_end_date) {
    lockInForfeiture = bed.price_per_month; // 1 month penalty
  }

  // Deposit refund
  const deposit = tenant.security_deposit;
  const totalDeductions = proRataOwed + noticePenalty + lockInForfeiture + damages;
  const refundable = Math.max(0, deposit - totalDeductions);

  return { proRataOwed, noticePenalty, lockInForfeiture, deposit, refundable };
}
```

---

## Part 4: HRA Rent Receipt (High-Value, Easy to Build)

This is a genuine reason IT employees in Bangalore choose a PG. Cheap to add, high perceived value.

### What the Receipt Must Include (as per IT Dept rules)
- Receipt Number (auto: RCT-2026-001)
- Month & Year
- Tenant Name
- PAN of Landlord (PG Owner)
- Name of Landlord
- Full address of PG
- Amount paid in words
- Signature line (digital)

### Implementation (Supabase + React PDF)
```javascript
// Use react-pdf or jsPDF to generate
// Store in Supabase storage: receipts/{pg_id}/{tenant_id}/{month}.pdf
// Tenant can download from their portal

const receipt = {
  receipt_number: `RCT-${year}-${padded_serial}`,
  owner_name: pg.owner_name,
  owner_pan: pg.owner_pan,
  tenant_name: tenant.name,
  property_address: pg.property_address,
  month_for: "June 2026",
  amount: payment.amount,
  amount_in_words: toWords(payment.amount)
};
```

**Tenant Portal:** Add a "Download HRA Receipt" button next to each month's payment row.  
**This feature alone justifies the product's price for any IT employee tenant.**

---

## Part 5: Food Model Fix (Invert the Default)

**Wrong (current):** Food is opt-IN. Tenant is added, food is off, admin enables it.  
**Correct (Bangalore):** Food is INCLUDED in rent by default. Tenant opts OUT if they don't want it.

### Property-Level Flag (in `pg_accounts`)
```sql
food_included_default = true   -- for most Bangalore PGs
food_opt_out_deduction = 2500  -- this much is deducted from rent if tenant opts out
```

### Tenant Portal: Food Opt-Out Toggle
```
My Meals
[Toggle: Food Included ✅]  ← default ON
"Your rent includes breakfast & dinner (Mon–Sat)."
"Toggle off to opt out. ₹2,500 will be deducted from your next bill."
```

---

## Part 6: Updated Room Add Flow (With Rate Card)

**Old flow:** Admin types room number → types rent amount manually.

**New flow:**
1. Admin sets up **Rate Card** once (under Settings):
   - Single AC Attached Bath → ₹16,000/month (food included)
   - Double Sharing AC Common Bath → ₹10,500/month (food included)
   - Triple Sharing Non-AC → ₹7,500/month (food included)

2. Admin adds a Room: Room 101, Type = Double Sharing AC, 2 beds
   → System auto-creates **Bed B-101-1** and **Bed B-101-2**, each priced at ₹10,500

3. Admin adds a Tenant:
   → Selects Bed B-101-1
   → Rent auto-fills as ₹10,500
   → No manual typing

---

## Part 7: Occupancy Dashboard (Bed-Level)

**Current:** Shows occupied_beds as a number. No visibility into which bed, from when.

**New Occupancy View:**

```
Room 101 — Double Sharing AC
  Bed B-101-1  ● Occupied  — Rahul Kumar  (since 3 Apr)   ₹10,500
  Bed B-101-2  ○ Vacant    — Available from 20 Jun        ₹10,500

Room 102 — Triple Sharing Non-AC
  Bed B-102-1  ● Occupied  — Priya Sharma (since 1 May)   ₹7,500
  Bed B-102-2  ● Occupied  — Arun Raj     (since 15 May)  ₹7,500
  Bed B-102-3  ○ Vacant    — Available Now                 ₹7,500
```

**Vacancy KPI:** "3 beds vacant — ₹25,500/month revenue gap"  
This is what PG owners actually want to see.

---

## Part 8: Revised Build Priority

### Phase A1 — Bangalore Beds Foundation (Do This First)
```
□ Rate card setup screen (Settings → Pricing)
□ beds table + auto-create beds when room is added
□ Tenant add → bed picker (not room picker)
□ Rent auto-filled from rate card (not manual)
□ Occupancy view: bed-level (vacant/occupied + available from)
```

### Phase A2 — Bangalore Money Model
```
□ Pro-rata first month calculation
□ Food opt-out toggle (property default = included)
□ Joining fee (one-time, non-refundable)
□ pg_policies table: notice period, lock-in, deposit = N months
□ Checkout settlement calculator
□ HRA rent receipt PDF generation + download
```

### Phase A3 — Core Operations (Already Planned)
```
□ Complaint management + resolution
□ MSG91 WhatsApp reminders (ahead of SMS — WhatsApp first)
□ Payment screenshot upload
□ Expense management
□ P&L report
```

### Phase B — Growth Features
```
□ Daily / short stay (near tech parks)
□ Lead source tracking (broker / NoBroker / referral + commission)
□ Occupancy analytics: avg vacancy days, revenue gap
□ React Native tenant app
```

---

## Part 9: What's Genuinely Right — Don't Touch

| Component | Status | Why |
|-----------|--------|-----|
| Super Admin → Admin → Staff → Tenant roles | ✅ Keep | Textbook correct multi-tenant |
| RLS with owner_id = auth.uid() | ✅ Keep | Secure, correct |
| Multi-property (pg_id on every table) | ✅ Keep | Matches Bangalore operators with 2–5 buildings |
| UPI + payment screenshot | ✅ Keep | Matches actual payment behavior |
| Complaints + issue tracking | ✅ Keep | Needed, works |
| Food menu display (tenant portal) | ✅ Keep | Good UX |
| Notifications (in-app + MSG91) | ✅ Keep | Correct channel choice |
| Module toggles (hide food/electricity) | ✅ Keep | Right for budget PGs |

---

## Part 10: WiFi Password Feature — Recalibrate

Your notes list WiFi password in tenant portal as "the killer feature."  
**Reality check:** It's a nice convenience, NOT a differentiator. Every PG owner can just put it on a notice board.

**Real differentiators that close sales:**
1. **HRA Rent Receipt PDF** — IT tenants will switch PGs for this
2. **Bed-level occupancy** — owners know exactly which bed earns, which is bleeding
3. **Checkout settlement calculator** — saves a fight every time someone leaves
4. **Pro-rata billing** — reduces move-in confusion and disputes
5. **WhatsApp-first reminders** — owners live on WhatsApp, not email

Lead your demo with these 5, not WiFi password.

---

## Summary: What Changes, What Stays

| Area | Action |
|------|--------|
| `rooms.rent_amount` | → Move to `rate_cards` table |
| `rooms.occupied_beds` (counter) | → Replace with `beds` table |
| `tenants.rent_amount` (manual) | → Derive from `beds.price_per_month` |
| Food: opt-in default | → Flip to opt-out (food included by default) |
| `payments` invoice | → Add pro-rata, food opt-out deduction |
| Checkout flow | → Add `checkout_settlements` table with full calc |
| New: `beds` table | → Add |
| New: `rate_cards` table | → Add |
| New: `pg_policies` table | → Add (notice, lock-in, deposit months) |
| New: `joining_fees` table | → Add |
| New: `rent_receipts` (HRA) table | → Add |
| New: `checkout_settlements` table | → Add |
| Everything else (roles, RLS, payments, complaints, notifications) | → Keep as-is |

---

*This redesign keeps ~70% of existing work intact. The beds + rate card + money model changes are focused and non-destructive to the overall architecture.*

