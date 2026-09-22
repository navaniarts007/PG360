-- =============================================================================
-- Shanthi Ladies Hostel · MySQL translation — columns added to the 6 core
-- tables (001_core_schema.sql) by migrations 0005 through 0038. Run after
-- 001 and 002. Ends with the final (0027) version of the payment total
-- trigger — see README/chat notes on the food_opt_out_deduction discrepancy
-- this carries forward exactly as it is in production today.
-- =============================================================================

-- ------------------------------------------------------------- pg_accounts
alter table pg_accounts
  add column if not exists upi_id text null,
  add column if not exists bank_details text null,
  add column if not exists payment_qr_url text null,
  add column if not exists owner_id char(36) null,
  add column if not exists settings json not null default (json_object()),
  add column if not exists owner_pan varchar(20) null,
  add column if not exists property_address text null,
  add column if not exists food_included_default tinyint(1) not null default 1,
  add column if not exists food_opt_out_deduction int not null default 0,
  add column if not exists edition varchar(20) not null default 'full',
  add column if not exists portal_enabled tinyint(1) not null default 1,
  add column if not exists reg_prefix varchar(20) null,
  add column if not exists owner_signature_url text null,
  add column if not exists is_demo tinyint(1) not null default 0,
  add column if not exists rules_doc_url text null;

alter table pg_accounts
  add constraint fk_pg_accounts_owner foreign key (owner_id) references users (id) on delete set null;

alter table pg_accounts
  add constraint chk_pg_accounts_edition check (edition in ('full', 'gvm'));

-- --------------------------------------------------------------- tenants
alter table tenants
  add column if not exists food_opt_out tinyint(1) not null default 0,
  add column if not exists joining_date date null,
  add column if not exists notice_given_date date null,
  add column if not exists lock_in_end_date date null,
  add column if not exists avatar_url text null,
  add column if not exists reg_no varchar(50) null,
  add column if not exists stay_type varchar(20) not null default 'monthly',
  add column if not exists daily_rate decimal(12,2) null,
  add column if not exists stay_days int null,
  add column if not exists parent_phone varchar(32) null,
  add column if not exists address text null,
  add column if not exists occupation varchar(100) null,
  add column if not exists organization varchar(255) null,
  add column if not exists father_name varchar(255) null,
  add column if not exists mother_name varchar(255) null,
  add column if not exists guardian text null,
  add column if not exists vehicle_number varchar(32) null;

alter table tenants
  add constraint chk_tenants_stay_type check (stay_type in ('monthly', 'daily'));

-- --------------------------------------------------------------- payments
alter table payments
  add column if not exists verified tinyint(1) not null default 0,
  add column if not exists is_pro_rata tinyint(1) not null default 0,
  add column if not exists pro_rata_days int null,
  add column if not exists food_opt_out_deduction int not null default 0,
  add column if not exists security_deposit int not null default 0,
  add column if not exists joining_fee int not null default 0;

-- --------------------------------------------------------------- profiles
alter table profiles
  add column if not exists terms_accepted_at datetime null,
  add column if not exists terms_version varchar(20) null,
  add column if not exists permissions json null;

-- ------------------------------------------------------------------ rooms
-- 0013: room type is free text now (rate-card-driven types include quad/dorm).
alter table rooms drop check chk_rooms_type;
alter table rooms modify column type varchar(50) not null;

-- =============================================================================
-- Final payment total/status trigger (0001 -> 0010 -> 0027, last write wins).
-- This is the ACTUAL formula live in production today: it does NOT subtract
-- food_opt_out_deduction (0010 added that, 0027 silently dropped it when
-- security_deposit/joining_fee were folded in) and has no floor-at-zero
-- clamp. Replicated exactly, not "fixed" — flag if that's not what you want.
-- =============================================================================
drop trigger if exists trg_payment_status_ins;
drop trigger if exists trg_payment_status_upd;

delimiter //

create trigger trg_payment_status_ins before insert on payments
for each row
begin
  set new.total_amount = coalesce(new.base_rent,0) + coalesce(new.electricity_charge,0)
                        + coalesce(new.food_charge,0) + coalesce(new.other_charges,0)
                        + coalesce(new.security_deposit,0) + coalesce(new.joining_fee,0);
  if new.amount_paid >= new.total_amount and new.total_amount > 0 then
    set new.status = 'paid';
  elseif new.amount_paid > 0 then
    set new.status = 'partial';
  else
    set new.status = 'due';
  end if;
end//

create trigger trg_payment_status_upd before update on payments
for each row
begin
  set new.total_amount = coalesce(new.base_rent,0) + coalesce(new.electricity_charge,0)
                        + coalesce(new.food_charge,0) + coalesce(new.other_charges,0)
                        + coalesce(new.security_deposit,0) + coalesce(new.joining_fee,0);
  if new.amount_paid >= new.total_amount and new.total_amount > 0 then
    set new.status = 'paid';
  elseif new.amount_paid > 0 then
    set new.status = 'partial';
  else
    set new.status = 'due';
  end if;
end//

delimiter ;
