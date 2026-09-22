-- =============================================================================
-- Shanthi Ladies Hostel · MySQL 8.0 translation of supabase/migrations/0001_schema.sql
-- Target: MySQL 8.0.36 (confirmed on the OVI Panel VPS).
--
-- IMPORTANT — read deploy/clients/shanthis-ladies-hostel/mysql/RLS_TO_APP_LAYER.md
-- before writing any server action against this schema. Postgres RLS enforced
-- tenant isolation automatically on every query; none of that exists here.
-- Every query against these tables MUST manually filter by pg_id / user_id per
-- that checklist, or one PG's staff can read/write another PG's data.
--
-- No `auth.users` here — see AUTH_DESIGN.md. `users` below replaces it.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- users : replaces Supabase Auth's auth.users. Our own credential store.
-- ---------------------------------------------------------------------------
create table if not exists users (
  id            char(36)     not null primary key default (uuid()),
  email         varchar(255) not null unique,
  password_hash varchar(255) not null,   -- bcrypt, see AUTH_DESIGN.md
  created_at    datetime     not null default current_timestamp
) engine=InnoDB;

-- ---------------------------------------------------------------------------
-- sessions : replaces Supabase Auth's session/JWT handling.
-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id          char(36)     not null primary key default (uuid()),
  user_id     char(36)     not null,
  expires_at  datetime     not null,
  created_at  datetime     not null default current_timestamp,
  constraint fk_sessions_user foreign key (user_id) references users (id) on delete cascade
) engine=InnoDB;

create index idx_sessions_user on sessions (user_id);
create index idx_sessions_expires on sessions (expires_at);

-- ---------------------------------------------------------------------------
-- profiles : maps each user to a role + pg. The security backbone.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id          char(36)     not null primary key,
  role        varchar(20)  not null,
  pg_id       char(36)     null,                       -- null only for super_admin
  full_name   varchar(255) not null,
  phone       varchar(32)  null,
  created_at  datetime     not null default current_timestamp,
  constraint fk_profiles_user foreign key (id) references users (id) on delete cascade,
  constraint chk_profiles_role check (role in ('super_admin', 'admin', 'staff', 'tenant'))
) engine=InnoDB;

-- ---------------------------------------------------------------------------
-- pg_accounts : one row per PG (the tenant boundary of the SaaS).
-- ---------------------------------------------------------------------------
create table if not exists pg_accounts (
  id                   char(36)     not null primary key default (uuid()),
  owner_name           varchar(255) not null,
  pg_name              varchar(255) not null,
  mobile               varchar(32)  not null,
  location             varchar(255) not null,
  pg_type              varchar(20)  not null,
  category             varchar(20)  not null,
  status               varchar(20)  not null default 'active',
  subscription_plan    varchar(20)  not null,
  subscription_expiry  date         null,
  created_by           char(36)     null,
  created_at           datetime     not null default current_timestamp,
  constraint fk_pg_accounts_created_by foreign key (created_by) references profiles (id),
  constraint chk_pg_accounts_type check (pg_type in ('boys', 'girls', 'coliving')),
  constraint chk_pg_accounts_category check (category in ('budget', 'standard', 'premium')),
  constraint chk_pg_accounts_status check (status in ('active', 'suspended')),
  constraint chk_pg_accounts_plan check (subscription_plan in ('monthly', 'yearly', 'lifetime'))
) engine=InnoDB;

alter table profiles
  add constraint fk_profiles_pg foreign key (pg_id) references pg_accounts (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
create table if not exists rooms (
  id            char(36)     not null primary key default (uuid()),
  pg_id         char(36)     not null,
  room_number   varchar(50)  not null,
  floor         int          not null default 0,
  type          varchar(20)  not null,
  total_beds    int          not null,
  occupied_beds int          not null default 0,
  rent_amount   int          not null default 0,
  wifi_password varchar(255) not null default '',
  amenities     json         not null default (json_array()),
  status        varchar(20)  not null default 'vacant',
  created_at    datetime     not null default current_timestamp,
  constraint fk_rooms_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint uq_rooms_pg_number unique (pg_id, room_number),
  constraint chk_rooms_type check (type in ('single', 'double', 'triple')),
  constraint chk_rooms_total_beds check (total_beds > 0),
  constraint chk_rooms_occupied_beds check (occupied_beds >= 0),
  constraint chk_rooms_status check (status in ('vacant', 'partial', 'occupied'))
) engine=InnoDB;

create index idx_rooms_pg on rooms (pg_id);

-- ---------------------------------------------------------------------------
-- tenants : a resident. user_id links to their login (nullable until set).
-- ---------------------------------------------------------------------------
create table if not exists tenants (
  id                char(36)     not null primary key default (uuid()),
  pg_id             char(36)     not null,
  room_id           char(36)     null,
  user_id           char(36)     null,
  name              varchar(255) not null,
  phone             varchar(32)  not null,
  email             varchar(255) null,
  aadhaar_number    varchar(32)  null,
  aadhaar_photo_url text         null,
  emergency_contact varchar(32)  null,
  rent_amount       int          not null default 0,
  security_deposit  int          not null default 0,
  checkin_date      date         not null default (curdate()),
  checkout_date     date         null,
  rent_due_day      int          not null default 5,
  food_plan_active  tinyint(1)   not null default 0,
  status            varchar(20)  not null default 'active',
  created_at        datetime     not null default current_timestamp,
  constraint fk_tenants_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_tenants_room foreign key (room_id) references rooms (id) on delete set null,
  constraint fk_tenants_user foreign key (user_id) references users (id) on delete set null,
  constraint chk_tenants_due_day check (rent_due_day between 1 and 28),
  constraint chk_tenants_status check (status in ('active', 'checked_out'))
) engine=InnoDB;

create index idx_tenants_pg on tenants (pg_id);
create index idx_tenants_user on tenants (user_id);

-- ---------------------------------------------------------------------------
-- payments : one bill per tenant per month.
-- ---------------------------------------------------------------------------
create table if not exists payments (
  id                     char(36)    not null primary key default (uuid()),
  pg_id                  char(36)    not null,
  tenant_id              char(36)    not null,
  month_for              varchar(7)  not null,  -- 'YYYY-MM'
  base_rent              int         not null default 0,
  electricity_charge     int         not null default 0,
  food_charge            int         not null default 0,
  other_charges          int         not null default 0,
  total_amount           int         not null default 0,
  amount_paid            int         not null default 0,
  payment_mode           varchar(10) null,
  payment_screenshot_url text        null,
  payment_date           date        null,
  status                 varchar(10) not null default 'due',
  notes                  text        null,
  created_at             datetime    not null default current_timestamp,
  constraint fk_payments_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_payments_tenant foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint uq_payments_tenant_month unique (tenant_id, month_for),
  constraint chk_payments_mode check (payment_mode in ('cash', 'upi', 'bank')),
  constraint chk_payments_status check (status in ('paid', 'partial', 'due'))
) engine=InnoDB;

create index idx_payments_pg on payments (pg_id);
create index idx_payments_tenant on payments (tenant_id);

-- ---------------------------------------------------------------------------
-- issues : tenant complaints.
-- ---------------------------------------------------------------------------
create table if not exists issues (
  id          char(36)    not null primary key default (uuid()),
  pg_id       char(36)    not null,
  tenant_id   char(36)    not null,
  category    varchar(20) not null,
  description text        not null,
  photo_url   text        null,
  status      varchar(20) not null default 'open',
  assigned_to char(36)    null,
  created_at  datetime    not null default current_timestamp,
  resolved_at datetime    null,
  constraint fk_issues_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_issues_tenant foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint fk_issues_assigned foreign key (assigned_to) references profiles (id),
  constraint chk_issues_category check (category in ('electricity','plumbing','wifi','cleaning','noise','other')),
  constraint chk_issues_status check (status in ('open', 'in_progress', 'resolved'))
) engine=InnoDB;

create index idx_issues_pg on issues (pg_id);
create index idx_issues_tenant on issues (tenant_id);

-- ---------------------------------------------------------------------------
-- Triggers: derive room.status from occupied_beds / total_beds.
-- MySQL triggers can't be scoped to "of specific columns" like Postgres, and
-- INSERT/UPDATE need separate trigger bodies.
-- ---------------------------------------------------------------------------
delimiter //

create trigger trg_room_status_ins before insert on rooms
for each row
begin
  if new.occupied_beds <= 0 then
    set new.status = 'vacant';
  elseif new.occupied_beds >= new.total_beds then
    set new.status = 'occupied';
  else
    set new.status = 'partial';
  end if;
end//

create trigger trg_room_status_upd before update on rooms
for each row
begin
  if new.occupied_beds <= 0 then
    set new.status = 'vacant';
  elseif new.occupied_beds >= new.total_beds then
    set new.status = 'occupied';
  else
    set new.status = 'partial';
  end if;
end//

-- ---------------------------------------------------------------------------
-- Triggers: derive payment.total_amount + status from the charge breakdown.
-- ---------------------------------------------------------------------------
create trigger trg_payment_status_ins before insert on payments
for each row
begin
  set new.total_amount = coalesce(new.base_rent,0) + coalesce(new.electricity_charge,0)
                        + coalesce(new.food_charge,0) + coalesce(new.other_charges,0);
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
                        + coalesce(new.food_charge,0) + coalesce(new.other_charges,0);
  if new.amount_paid >= new.total_amount and new.total_amount > 0 then
    set new.status = 'paid';
  elseif new.amount_paid > 0 then
    set new.status = 'partial';
  else
    set new.status = 'due';
  end if;
end//

delimiter ;
