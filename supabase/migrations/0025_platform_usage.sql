-- =============================================================================
-- PG360 · 0025_platform_usage.sql — live Supabase usage snapshot for the
-- super-admin dashboard. SECURITY DEFINER so it can read db size / auth /
-- storage, but it returns data only to a super_admin caller. Idempotent.
-- =============================================================================

create or replace function public.platform_usage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if public.current_role() <> 'super_admin' then
    return '{}'::jsonb;
  end if;
  select jsonb_build_object(
    'db_bytes',        pg_database_size(current_database()),
    'auth_users',      (select count(*) from auth.users),
    'storage_objects', (select count(*) from storage.objects),
    'storage_bytes',   (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
    'pg_count',        (select count(*) from public.pg_accounts),
    'tenant_count',    (select count(*) from public.tenants),
    'payment_count',   (select count(*) from public.payments),
    'activity_count',  (select count(*) from public.activity_log)
  ) into result;
  return result;
end $$;

grant execute on function public.platform_usage() to authenticated;
