-- =============================================================================
-- Shanthi Ladies Hostel · MySQL translation, new tables from migrations 0003-0038
-- Depends on 001_core_schema.sql (users, profiles, pg_accounts, rooms, tenants,
-- payments, issues). See RLS_TO_APP_LAYER.md for every access rule that must be
-- enforced in application code for these tables — none of it is in the DB.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- property_members (0006) — multi-property staff membership. Central to
-- authorization: "properties this user may touch" = rows here, not a single
-- profiles.pg_id. Replaces Postgres's current_property_ids() function.
-- ---------------------------------------------------------------------------
create table if not exists property_members (
  id          char(36)    not null primary key default (uuid()),
  property_id char(36)    not null,
  user_id     char(36)    not null,
  role        varchar(20) not null,
  created_at  datetime    not null default current_timestamp,
  constraint fk_propmem_property foreign key (property_id) references pg_accounts (id) on delete cascade,
  constraint fk_propmem_user foreign key (user_id) references users (id) on delete cascade,
  constraint uq_propmem unique (property_id, user_id),
  constraint chk_propmem_role check (role in ('admin', 'staff'))
) engine=InnoDB;

create index idx_propmem_user on property_members (user_id);

-- ---------------------------------------------------------------------------
-- bookings (0003) — inbound tenant enquiries.
-- ---------------------------------------------------------------------------
create table if not exists bookings (
  id                  char(36)    not null primary key default (uuid()),
  pg_id               char(36)    not null,
  tenant_name         varchar(255) not null,
  phone               varchar(32)  not null,
  preferred_room_type varchar(20)  not null,
  requested_date      date         null,
  status              varchar(20)  not null default 'pending',
  notes               text         null,
  created_at          datetime     not null default current_timestamp,
  constraint fk_bookings_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint chk_bookings_room_type check (preferred_room_type in ('single','double','triple','any')),
  constraint chk_bookings_status check (status in ('pending','approved','rejected'))
) engine=InnoDB;

create index idx_bookings_pg on bookings (pg_id);

-- ---------------------------------------------------------------------------
-- food_menu (0003)
-- ---------------------------------------------------------------------------
create table if not exists food_menu (
  id          char(36)    not null primary key default (uuid()),
  pg_id       char(36)    not null,
  day_of_week int         not null,
  meal_type   varchar(20) not null,
  description text        not null default '',
  created_at  datetime    not null default current_timestamp,
  constraint fk_food_menu_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint uq_food_menu unique (pg_id, day_of_week, meal_type),
  constraint chk_food_menu_day check (day_of_week between 0 and 6),
  constraint chk_food_menu_meal check (meal_type in ('breakfast','lunch','dinner'))
) engine=InnoDB;

create index idx_food_menu_pg on food_menu (pg_id);

-- ---------------------------------------------------------------------------
-- food_opt (0003) — per-tenant daily meal opt-in/out.
-- ---------------------------------------------------------------------------
create table if not exists food_opt (
  id        char(36)    not null primary key default (uuid()),
  pg_id     char(36)    not null,
  tenant_id char(36)    not null,
  opt_date  date        not null,
  meal_type varchar(20) not null,
  opted_in  tinyint(1)  not null default 1,
  constraint fk_food_opt_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_food_opt_tenant foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint uq_food_opt unique (tenant_id, opt_date, meal_type),
  constraint chk_food_opt_meal check (meal_type in ('breakfast','lunch','dinner'))
) engine=InnoDB;

create index idx_food_opt_tenant on food_opt (tenant_id);

-- ---------------------------------------------------------------------------
-- expenses (0003, category CHECK relaxed by 0028, subcategory added by 0029)
-- ---------------------------------------------------------------------------
create table if not exists expenses (
  id          char(36)    not null primary key default (uuid()),
  pg_id       char(36)    not null,
  category    varchar(50) not null,   -- free text as of 0028; app offers built-in defaults
  subcategory varchar(50) null,       -- 0029
  amount      int         not null,
  expense_date date       not null default (curdate()),
  description text        null,
  added_by    char(36)    null,
  created_at  datetime    not null default current_timestamp,
  constraint fk_expenses_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_expenses_added_by foreign key (added_by) references profiles (id),
  constraint chk_expenses_amount check (amount >= 0)
) engine=InnoDB;

create index idx_expenses_pg on expenses (pg_id);

-- ---------------------------------------------------------------------------
-- expense_categories (0028) + parent/sub-category (0029)
-- ---------------------------------------------------------------------------
create table if not exists expense_categories (
  id         char(36)     not null primary key default (uuid()),
  pg_id      char(36)     not null,
  parent     varchar(50)  not null default '',
  name       varchar(255) not null,
  created_at datetime     not null default current_timestamp,
  constraint fk_expense_cat_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint uq_expense_cat unique (pg_id, parent, name)
) engine=InnoDB;

create index idx_expense_categories_pg on expense_categories (pg_id);

-- ---------------------------------------------------------------------------
-- notifications (0003) — recipient is now a user, not auth.users.
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id             char(36)    not null primary key default (uuid()),
  pg_id          char(36)    not null,
  recipient_id   char(36)    not null,
  recipient_type varchar(20) not null,
  message        text        not null,
  link           text        null,
  is_read        tinyint(1)  not null default 0,
  created_at     datetime    not null default current_timestamp,
  constraint fk_notif_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_notif_recipient foreign key (recipient_id) references users (id) on delete cascade,
  constraint chk_notif_type check (recipient_type in ('admin','staff','tenant'))
) engine=InnoDB;

create index idx_notif_recipient on notifications (recipient_id, is_read);

-- NOTE (0004 realtime): the in-app notification bell relied on Supabase
-- Realtime pushing new `notifications` rows to the browser. MySQL has no
-- equivalent — the app will need polling or a separate mechanism (SSE/
-- WebSocket server) to get live updates. Not built here; flagging as a
-- product-behavior gap, not just a schema one.

-- ---------------------------------------------------------------------------
-- rate_cards (0007)
-- ---------------------------------------------------------------------------
create table if not exists rate_cards (
  id                     char(36)     not null primary key default (uuid()),
  pg_id                  char(36)     not null,
  name                   varchar(255) not null,
  room_type              varchar(50)  not null,
  ac                     tinyint(1)   not null default 0,
  bath_type              varchar(20)  not null default 'common',
  price_per_month        int          not null default 0,
  food_included          tinyint(1)   not null default 1,
  food_opt_out_deduction int          not null default 0,
  created_at             datetime     not null default current_timestamp,
  constraint fk_rate_cards_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint uq_rate_cards unique (pg_id, room_type, ac, bath_type, price_per_month),
  constraint chk_rate_cards_bath check (bath_type in ('attached','common'))
) engine=InnoDB;

create index idx_rate_cards_pg on rate_cards (pg_id);

-- ---------------------------------------------------------------------------
-- beds (0007) — occupancy unit; syncs rooms.occupied_beds via trigger.
-- ---------------------------------------------------------------------------
create table if not exists beds (
  id                char(36)    not null primary key default (uuid()),
  pg_id             char(36)    not null,
  room_id           char(36)    not null,
  bed_number        varchar(50) not null,
  rate_card_id      char(36)    null,
  price_per_month   int         not null default 0,
  status            varchar(20) not null default 'vacant',
  current_tenant_id char(36)    null,
  available_from    date        null,
  notes             text        null,
  created_at        datetime    not null default current_timestamp,
  constraint fk_beds_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_beds_room foreign key (room_id) references rooms (id) on delete cascade,
  constraint fk_beds_rate_card foreign key (rate_card_id) references rate_cards (id) on delete set null,
  constraint fk_beds_tenant foreign key (current_tenant_id) references tenants (id) on delete set null,
  constraint uq_beds unique (room_id, bed_number),
  constraint chk_beds_status check (status in ('vacant','occupied'))
) engine=InnoDB;

create index idx_beds_pg on beds (pg_id);
create index idx_beds_room on beds (room_id);

alter table tenants add column if not exists bed_id char(36) null;
alter table tenants add constraint fk_tenants_bed foreign key (bed_id) references beds (id) on delete set null;

delimiter //

create trigger trg_sync_room_occupancy_ins after insert on beds
for each row
begin
  update rooms set occupied_beds = (select count(*) from beds where room_id = new.room_id and status = 'occupied')
    where id = new.room_id;
end//

create trigger trg_sync_room_occupancy_upd after update on beds
for each row
begin
  update rooms set occupied_beds = (select count(*) from beds where room_id = new.room_id and status = 'occupied')
    where id = new.room_id;
  if old.room_id <> new.room_id then
    update rooms set occupied_beds = (select count(*) from beds where room_id = old.room_id and status = 'occupied')
      where id = old.room_id;
  end if;
end//

create trigger trg_sync_room_occupancy_del after delete on beds
for each row
begin
  update rooms set occupied_beds = (select count(*) from beds where room_id = old.room_id and status = 'occupied')
    where id = old.room_id;
end//

delimiter ;

-- ---------------------------------------------------------------------------
-- floors (0008)
-- ---------------------------------------------------------------------------
create table if not exists floors (
  id         char(36)     not null primary key default (uuid()),
  pg_id      char(36)     not null,
  name       varchar(255) not null,
  sort_order int          not null default 0,
  created_at datetime     not null default current_timestamp,
  constraint fk_floors_pg foreign key (pg_id) references pg_accounts (id) on delete cascade
) engine=InnoDB;

create index idx_floors_pg on floors (pg_id);

alter table rooms add column if not exists floor_id char(36) null;
alter table rooms add constraint fk_rooms_floor foreign key (floor_id) references floors (id) on delete set null;

-- ---------------------------------------------------------------------------
-- pg_policies (0010)
-- ---------------------------------------------------------------------------
create table if not exists pg_policies (
  id                         char(36) not null primary key default (uuid()),
  pg_id                      char(36) not null unique,
  notice_period_days         int      not null default 30,
  lock_in_months             int      not null default 0,
  deposit_months             int      not null default 1,
  electricity_included_units int      not null default 0,
  electricity_per_unit_rate  int      not null default 0,
  created_at                 datetime not null default current_timestamp,
  constraint fk_pg_policies_pg foreign key (pg_id) references pg_accounts (id) on delete cascade
) engine=InnoDB;

-- ---------------------------------------------------------------------------
-- joining_fees (0010)
-- ---------------------------------------------------------------------------
create table if not exists joining_fees (
  id          char(36)     not null primary key default (uuid()),
  pg_id       char(36)     not null,
  tenant_id   char(36)     not null,
  amount      int          not null default 0,
  description varchar(255) not null default 'Admission / Joining Fee',
  paid        tinyint(1)   not null default 0,
  paid_date   date         null,
  created_at  datetime     not null default current_timestamp,
  constraint fk_joining_fees_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_joining_fees_tenant foreign key (tenant_id) references tenants (id) on delete cascade
) engine=InnoDB;

create index idx_joining_fees_pg on joining_fees (pg_id);
create index idx_joining_fees_tenant on joining_fees (tenant_id);

-- ---------------------------------------------------------------------------
-- checkout_settlements (0010, advance_amount added by 0030)
-- ---------------------------------------------------------------------------
create table if not exists checkout_settlements (
  id                    char(36)    not null primary key default (uuid()),
  pg_id                 char(36)    not null,
  tenant_id             char(36)    not null,
  checkout_date         date        not null,
  last_paid_until       date        null,
  pro_rata_days_owed    int         not null default 0,
  pro_rata_amount       int         not null default 0,
  notice_shortfall_days int         not null default 0,
  notice_penalty        int         not null default 0,
  lock_in_forfeiture    int         not null default 0,
  damages_deduction     int         not null default 0,
  deposit_amount        int         not null default 0,
  advance_amount        int         not null default 0,
  refundable_amount     int         not null default 0,
  notes                 text        null,
  status                varchar(20) not null default 'draft',
  created_at             datetime   not null default current_timestamp,
  constraint fk_checkout_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_checkout_tenant foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint chk_checkout_status check (status in ('draft','confirmed','paid'))
) engine=InnoDB;

create index idx_checkout_pg on checkout_settlements (pg_id);
create index idx_checkout_tenant on checkout_settlements (tenant_id);

-- ---------------------------------------------------------------------------
-- wifi_networks (0011)
-- ---------------------------------------------------------------------------
create table if not exists wifi_networks (
  id         char(36)     not null primary key default (uuid()),
  pg_id      char(36)     not null,
  ssid       varchar(255) not null,
  password   varchar(255) not null default '',
  created_at datetime     not null default current_timestamp,
  constraint fk_wifi_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint uq_wifi unique (pg_id, ssid)
) engine=InnoDB;

create index idx_wifi_networks_pg on wifi_networks (pg_id);

alter table rooms add column if not exists wifi_network_id char(36) null;
alter table rooms add column if not exists wifi_ssid varchar(255) null;
alter table rooms add constraint fk_rooms_wifi foreign key (wifi_network_id) references wifi_networks (id) on delete set null;

-- ---------------------------------------------------------------------------
-- tenant_counters (0014) — atomic per-property sequential registration numbers.
-- See 004_counters_and_functions.sql for how to increment safely from MySQL.
-- ---------------------------------------------------------------------------
create table if not exists tenant_counters (
  pg_id   char(36) not null primary key,
  next_no int      not null default 1,
  constraint fk_tenant_counters_pg foreign key (pg_id) references pg_accounts (id) on delete cascade
) engine=InnoDB;

-- ---------------------------------------------------------------------------
-- tenant_events (0014) — per-tenant activity timeline.
-- ---------------------------------------------------------------------------
create table if not exists tenant_events (
  id         char(36)    not null primary key default (uuid()),
  pg_id      char(36)    not null,
  tenant_id  char(36)    not null,
  event_type varchar(20) not null,
  detail     text        null,
  room_id    char(36)    null,
  floor      int         null,
  created_by char(36)    null,
  created_at datetime    not null default current_timestamp,
  constraint fk_tenant_events_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_tenant_events_tenant foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint fk_tenant_events_room foreign key (room_id) references rooms (id) on delete set null,
  constraint fk_tenant_events_by foreign key (created_by) references profiles (id) on delete set null,
  constraint chk_tenant_events_type check (event_type in ('joined','room_changed','payment','complaint','note','checked_out'))
) engine=InnoDB;

create index idx_tenant_events_tenant on tenant_events (tenant_id, created_at);
create index idx_tenant_events_pg on tenant_events (pg_id);

-- ---------------------------------------------------------------------------
-- platform_invoices (0017, billing_cycle added 0018) — PG360's own billing of
-- the PG account, not a tenant-facing table. Numbering: see 004 for the MySQL
-- equivalent of the Postgres sequence.
-- ---------------------------------------------------------------------------
create table if not exists platform_invoices (
  id           char(36)       not null primary key default (uuid()),
  pg_id        char(36)       not null,
  number       bigint         not null,
  description  varchar(255)   not null default 'PG360 subscription',
  amount       decimal(12,2)  not null,
  tax_percent  decimal(5,2)   not null default 0,
  period_label varchar(50)    null,
  issue_date   date           not null default (curdate()),
  due_date     date           null,
  status       varchar(20)    not null default 'unpaid',
  billing_cycle varchar(20)   not null default 'one_time',
  notes        text           null,
  created_by   char(36)       null,
  created_at   datetime       not null default current_timestamp,
  constraint fk_platform_inv_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_platform_inv_by foreign key (created_by) references profiles (id) on delete set null,
  constraint chk_platform_inv_amount check (amount >= 0),
  constraint chk_platform_inv_tax check (tax_percent >= 0),
  constraint chk_platform_inv_status check (status in ('unpaid','paid')),
  constraint chk_platform_inv_cycle check (billing_cycle in ('one_time', 'monthly', 'yearly'))
) engine=InnoDB;

create index idx_platform_invoices_pg on platform_invoices (pg_id, created_at desc);

create table if not exists platform_invoice_seq (
  id      tinyint  not null primary key default 1,
  next_no bigint   not null default 1001,
  constraint chk_seq_singleton check (id = 1)
) engine=InnoDB;

insert into platform_invoice_seq (id, next_no) values (1, 1001)
  on duplicate key update id = id;

-- ---------------------------------------------------------------------------
-- agreement_sections + tenant_agreements (0021)
-- ---------------------------------------------------------------------------
create table if not exists agreement_sections (
  id         char(36)     not null primary key default (uuid()),
  pg_id      char(36)     not null,
  idx        int          not null default 0,
  title      varchar(255) not null,
  body       text         not null default '',
  created_at datetime     not null default current_timestamp,
  constraint fk_agr_sections_pg foreign key (pg_id) references pg_accounts (id) on delete cascade
) engine=InnoDB;

create index idx_agreement_sections_pg on agreement_sections (pg_id, idx);

create table if not exists tenant_agreements (
  id            char(36)  not null primary key default (uuid()),
  pg_id         char(36)  not null,
  tenant_id     char(36)  not null unique,
  signature_url text      not null,
  accepted_at   datetime  not null default current_timestamp,
  constraint fk_tenant_agr_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_tenant_agr_tenant foreign key (tenant_id) references tenants (id) on delete cascade
) engine=InnoDB;

-- ---------------------------------------------------------------------------
-- tenant_documents (0022)
-- ---------------------------------------------------------------------------
create table if not exists tenant_documents (
  id         char(36)    not null primary key default (uuid()),
  pg_id      char(36)    not null,
  tenant_id  char(36)    not null,
  doc_type   varchar(20) not null,
  file_url   text        not null,
  label      varchar(255) null,
  created_at datetime    not null default current_timestamp,
  constraint fk_tenant_docs_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_tenant_docs_tenant foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint chk_tenant_docs_type check (doc_type in ('aadhaar','dl','passport','voter','other'))
) engine=InnoDB;

create index idx_tenant_documents_tenant on tenant_documents (tenant_id);

-- ---------------------------------------------------------------------------
-- activity_log (0024) — no FKs on actor_* by design (survives user/pg deletion).
-- pg_id nullable = platform-level event.
-- ---------------------------------------------------------------------------
create table if not exists activity_log (
  id         char(36)     not null primary key default (uuid()),
  pg_id      char(36)     null,
  actor_id   char(36)     null,
  actor_name varchar(255) null,
  actor_role varchar(20)  null,
  action     varchar(255) not null,
  detail     text         null,
  created_at datetime     not null default current_timestamp,
  constraint fk_activity_pg foreign key (pg_id) references pg_accounts (id) on delete cascade
) engine=InnoDB;

create index idx_activity_pg on activity_log (pg_id, created_at);
create index idx_activity_created on activity_log (created_at);

-- ---------------------------------------------------------------------------
-- renewal_checks (0036)
-- ---------------------------------------------------------------------------
create table if not exists renewal_checks (
  id          char(36)    not null primary key default (uuid()),
  pg_id       char(36)    not null,
  tenant_id   char(36)    not null,
  cycle_end   date        not null,
  decision    varchar(20) null,
  decided_at  datetime    null,
  decided_by  char(36)    null,
  notified_at datetime    null,
  created_at  datetime    not null default current_timestamp,
  constraint fk_renewal_pg foreign key (pg_id) references pg_accounts (id) on delete cascade,
  constraint fk_renewal_tenant foreign key (tenant_id) references tenants (id) on delete cascade,
  constraint uq_renewal unique (tenant_id, cycle_end),
  constraint chk_renewal_decision check (decision in ('extend', 'vacate'))
) engine=InnoDB;

create index idx_renewal_checks_pg on renewal_checks (pg_id);
