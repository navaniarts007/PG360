-- =============================================================================
-- Shanthi Ladies Hostel · MySQL equivalents of two Postgres helpers that don't
-- translate directly: next_tenant_no() (0014) and the platform_invoice_seq
-- sequence (0017). MySQL has no CREATE SEQUENCE and no INSERT...RETURNING, so
-- both use the standard MySQL atomic-counter idiom: an UPSERT that feeds
-- LAST_INSERT_ID(expr), then SELECT LAST_INSERT_ID() to read back the value
-- that specific connection just claimed. Safe under concurrent callers.
-- =============================================================================

delimiter //

-- Call from app code as: CALL next_tenant_no(p_pg_id, @n); then read @n.
--
-- NOTE: LAST_INSERT_ID(expr) only fires on the ON DUPLICATE KEY UPDATE
-- branch — a fresh INSERT (first call for a given pg_id, no row yet) never
-- touches it, so LAST_INSERT_ID() would incorrectly read back 0. ROW_COUNT()
-- disambiguates: 1 = fresh insert (value is 1, the literal we inserted),
-- 2 = existing row updated (value is whatever LAST_INSERT_ID() now holds).
-- Verified against a live MariaDB test run before this fix: first call
-- returned 0 instead of 1.
create procedure next_tenant_no(in p_pg char(36), out p_next int)
begin
  insert into tenant_counters (pg_id, next_no) values (p_pg, 1)
    on duplicate key update next_no = last_insert_id(next_no + 1);
  if row_count() = 1 then
    set p_next = 1;
  else
    set p_next = last_insert_id();
  end if;
end//

-- Call from app code as: CALL next_platform_invoice_no(@n); then read @n.
create procedure next_platform_invoice_no(out p_next bigint)
begin
  update platform_invoice_seq set next_no = last_insert_id(next_no + 1) where id = 1;
  set p_next = last_insert_id();
end//

delimiter ;

-- Usage from the app's DB layer (mysql2 example):
--   const [, [row]] = await conn.query('CALL next_tenant_no(?, @n); SELECT @n AS n;', [pgId]);
--   const regNo = row.n;
