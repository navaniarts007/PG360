-- Rename PG billing plans from starter/pro to monthly/yearly.
update public.pg_accounts
set subscription_plan = 'monthly'
where subscription_plan = 'starter';

update public.pg_accounts
set subscription_plan = 'yearly'
where subscription_plan = 'pro';

alter table public.pg_accounts
  drop constraint if exists pg_accounts_subscription_plan_check;

alter table public.pg_accounts
  add constraint pg_accounts_subscription_plan_check
  check (subscription_plan in ('monthly', 'yearly', 'lifetime'));