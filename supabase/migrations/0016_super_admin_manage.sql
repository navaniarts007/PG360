-- =============================================================================
-- PG360 · 0016_super_admin_manage.sql — super-admin "open / manage a PG".
-- Today super_admin can only SELECT pg-scoped data. To let the platform owner
-- enter a PG and manage it (impersonation), grant super_admin full DML on every
-- pg-scoped table. The app still scopes writes to the impersonated property;
-- everyone else stays bound by their existing policies.
-- Idempotent — generated from any table carrying a pg_id column.
-- =============================================================================

do $$
declare t text;
begin
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tb
        on tb.table_schema = 'public'
       and tb.table_name = c.table_name
       and tb.table_type = 'BASE TABLE'
     where c.table_schema = 'public'
       and c.column_name = 'pg_id'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_super_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (public.current_role() = ''super_admin'') '
      || 'with check (public.current_role() = ''super_admin'')',
      t || '_super_all', t);
  end loop;
end $$;

-- property_members keys on property_id (not pg_id) — cover it explicitly.
drop policy if exists property_members_super_all on public.property_members;
create policy property_members_super_all on public.property_members
  for all to authenticated
  using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');
