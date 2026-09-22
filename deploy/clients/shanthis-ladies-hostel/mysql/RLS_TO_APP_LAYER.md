# RLS → application-layer checklist (core tables only)

Source: `supabase/migrations/0002_rls.sql`. Every rule below was previously
enforced by Postgres on every query, automatically, regardless of which
server action ran it. On MySQL, **each rule must be manually re-implemented
in every server action that touches these tables.** This file is the source
of truth for what "correct" looks like — check new/changed server actions
against it.

Postgres had three session-derived values available to every RLS policy:
`auth.uid()` (the logged-in user's id), `current_role()` (their profile
role), `current_pg_id()` (their profile's pg_id), `current_tenant_id()`
(their tenants.id if role = tenant). On MySQL/custom auth, the equivalent
must come from the session lookup (see AUTH_DESIGN.md) and be threaded
through every server action explicitly — there is no ambient context.

## profiles
- **Read**: a user may read their own profile row (`id = session.userId`),
  OR any row if `session.role = 'super_admin'`.
- **Update**: a user may update only their own profile row, and only
  non-privileged fields (role/pg_id must stay server-controlled, never
  settable from a user-supplied update — the original RLS didn't
  column-restrict this either, so this needs to be *stricter* than the
  original, not just equivalent: enforce which fields are updatable in the
  application code path, not just the row).
- **Insert**: server-side only (onboarding flow), never user-initiated.

## pg_accounts
- **All (read/write)**: `session.role = 'super_admin'` → unrestricted.
- **Read only**: any session whose `profile.pg_id = pg_accounts.id`.
- No other role may write to pg_accounts.

## rooms
- **All (read/write)**: `session.role in ('admin','staff') AND row.pg_id = session.pgId`.
- **Read only**: any session where `row.pg_id = session.pgId` (covers tenants —
  needed for "My Room" + WiFi password display).
- **Read only**: `session.role = 'super_admin'` → unrestricted read.

## tenants
- **All (read/write)**: `session.role in ('admin','staff') AND row.pg_id = session.pgId`.
- **Read only**: `row.user_id = session.userId` (a tenant reading their own record).
- **Read only**: `session.role = 'super_admin'` → unrestricted read.

## payments
- **All (read/write)**: `session.role in ('admin','staff') AND row.pg_id = session.pgId`.
- **Read only**: `row.tenant_id = session.tenantId` (a tenant's own payments —
  `session.tenantId` = the tenants row where `user_id = session.userId`).
- **Read only**: `session.role = 'super_admin'` → unrestricted read.

## issues
- **All (read/write)**: `session.role in ('admin','staff') AND row.pg_id = session.pgId`.
- **Read only**: `row.tenant_id = session.tenantId`.
- **Insert only** (tenants raising a complaint): `session.role = 'tenant' AND
  payload.tenant_id = session.tenantId AND payload.pg_id = session.pgId` —
  note this must be checked on the INSERT payload itself, not just row
  ownership, since the row doesn't exist yet at check time.

## Implementation guidance

Don't scatter these checks ad hoc across ~30 server actions. Build one
small authorization helper module (e.g. `assertPgScope(session, pgId)`,
`assertOwnRecordOrStaff(session, row)`) that every query in
`src/lib/actions/*.ts` and `src/lib/db.ts`-equivalent calls before/around
the actual SQL, so the rule lives in one place per pattern instead of being
re-typed (and potentially mistyped) in every action. This is the single
highest-risk part of the whole migration — a missing check here is a
cross-tenant data leak, not a cosmetic bug.

## Not yet covered

This file only covers the 6 tables in `001_core_schema.sql`. The other 32
migration files (`0003` through `0038`) each add their own RLS policies on
their own tables (agreements, tenant_documents, staff_permissions,
activity_log, expense_categories, renewal_checks, subscription_plans, rules
documents, etc.) — none of that has been translated yet. Same treatment
needed before any of those tables go live on MySQL.
