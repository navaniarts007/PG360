-- ---------------------------------------------------------------------------
-- 0029 — sub-categories for expenses. An expense_categories row is a top-level
-- category when parent = '', or a sub-category of `parent` otherwise. Works for
-- both built-in defaults (parent = 'utilities') and custom categories.
-- ---------------------------------------------------------------------------
alter table public.expense_categories
  add column if not exists parent text not null default '';

-- widen the uniqueness to (pg, parent, name) so the same sub-name can live under
-- different parents.
alter table public.expense_categories
  drop constraint if exists expense_categories_pg_id_name_key;
create unique index if not exists uq_expense_categories_pg_parent_name
  on public.expense_categories (pg_id, parent, name);

-- expenses carry an optional sub-category label alongside the category.
alter table public.expenses
  add column if not exists subcategory text;
