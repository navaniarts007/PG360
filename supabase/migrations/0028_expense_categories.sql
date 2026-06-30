-- ---------------------------------------------------------------------------
-- 0028 — custom expense categories. Owners can define their own expense
-- categories (a per-property "master") instead of the fixed 8-value list.
-- ---------------------------------------------------------------------------

-- The category column was a hard CHECK enum; relax it to free text so custom
-- categories validate. (App still offers the built-in defaults.)
alter table public.expenses drop constraint if exists expenses_category_check;

create table if not exists public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  pg_id       uuid not null references public.pg_accounts (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (pg_id, name)
);
create index if not exists idx_expense_categories_pg on public.expense_categories (pg_id);

alter table public.expense_categories enable row level security;

drop policy if exists expense_categories_staff_all on public.expense_categories;
create policy expense_categories_staff_all on public.expense_categories
  for all
  using (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'))
  with check (pg_id in (select public.current_property_ids()) and public.current_role() in ('admin','staff'));

drop policy if exists expense_categories_super_all on public.expense_categories;
create policy expense_categories_super_all on public.expense_categories
  for all
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');
