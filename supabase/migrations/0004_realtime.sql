-- =============================================================================
-- PG360 · 0004_realtime.sql — enable Supabase Realtime for notifications so the
-- in-app bell updates live. RLS still applies to realtime, so each user only
-- receives rows where recipient_id = auth.uid().
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
