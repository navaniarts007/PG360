# RLS → application-layer checklist (full schema, migrations 0001-0038)

Source: every `CREATE POLICY` across `supabase/migrations/*.sql`. Postgres
enforced all of this automatically, on every query, regardless of which
server action ran it. On MySQL, **each rule below must be manually
re-implemented in every server action that touches these tables.** This file
is the source of truth for what "correct" looks like.

Don't scatter these checks ad hoc across ~30 server actions — build one
small authorization helper module (e.g. `assertPropertyScope(session,
pgId)`, `assertOwnRecordOrStaff(session, row)`) that every query goes
through, so each rule lives in one place instead of being re-typed (and
potentially mistyped) 30 times. **This is the single highest-risk part of
the whole migration — a missing check here is a cross-tenant data leak, not
a cosmetic bug.**

## Session shape needed (replaces Postgres's auth.uid()/current_*() helpers)

Every check below needs these values from the session, resolved once per
request (see AUTH_DESIGN.md for how the session itself is established):

- `session.userId` — the logged-in user's id (was `auth.uid()`)
- `session.role` — `super_admin | admin | staff | tenant` (was `current_role()`)
- `session.propertyIds` — the set of `pg_accounts.id` this user is a member
  of, from `property_members` (was `current_property_ids()`) — **staff/admin
  checks use this set membership, not a single pg_id**, as of the 0006
  multi-property refactor. A user can belong to more than one property.
- `session.pgId` — a tenant's single property (from `profiles.pg_id`, was
  `current_pg_id()`) — tenants stay single-property; only staff/admin are
  multi-property.
- `session.tenantId` — the tenants.id row where `user_id = session.userId`,
  if the caller is a tenant (was `current_tenant_id()`).

## Global rule (0016): super_admin bypasses everything

As of 0016, `super_admin` has full read/write on **every table that carries
a `pg_id` column** (all of them below except `users`/`sessions`, which don't
exist in the RLS model at all — they're new). Implement this as a single
early-return in the authorization helper: `if (session.role ===
'super_admin') return allow;` — don't repeat it per table below.

## profiles
- Read: own row (`id = session.userId`) only. (super_admin bypass applies globally.)
- Update: own row only, and only non-privileged fields — role/pg_id/
  permissions must never be settable from a user-supplied update payload.
  This must be *stricter* in code than the original RLS was (RLS didn't
  column-restrict this either).
- Insert: server-side only (onboarding flow), never user-initiated.

## pg_accounts
- Read: `id` ∈ `session.propertyIds` (any member of that property, any role).
- Update: `admin` role AND `id` ∈ `session.propertyIds`.
- No other role may write.

## property_members
- Read: `user_id = session.userId` (own memberships only; super_admin sees all via global rule).

## rooms, tenants, payments, issues, bookings, food_menu, expenses,
## rate_cards, beds, floors, pg_policies, joining_fees, checkout_settlements,
## wifi_networks, tenant_counters, tenant_events, agreement_sections,
## expense_categories, renewal_checks
All of these share the same shape post-0006:
- Full read/write: `session.role in ('admin','staff') AND row.pg_id ∈ session.propertyIds`.
- Plus per-table read-only extensions, listed below where they differ from "none":
  - **rooms**: any session where `row.pg_id = session.pgId` may read (tenants — needed for "My Room" + WiFi display).
  - **tenants**: `row.user_id = session.userId` may read (tenant's own record).
  - **payments**: `row.tenant_id = session.tenantId` may read (tenant's own payments).
  - **issues**: `row.tenant_id = session.tenantId` may read; tenants may **insert** where `payload.tenant_id = session.tenantId AND payload.pg_id = session.pgId AND session.role = 'tenant'` — check the insert payload itself, the row doesn't exist yet.
  - **food_menu**: any session where `row.pg_id = session.pgId` may read (the menu is visible PG-wide).
  - **food_opt**: a tenant has full read/write on `row.tenant_id = session.tenantId` (with `pg_id = session.pgId` enforced on write); staff have read-only via the standard property-scoped rule above.
  - **beds**: any session where `row.pg_id = session.pgId` may read (tenants see their bed number).
  - **pg_policies**: any session where `row.pg_id = session.pgId` may read.
  - **joining_fees, checkout_settlements**: `row.tenant_id = session.tenantId` may read.
  - **agreement_sections**: `row.pg_id = session.pgId AND session.role = 'tenant'` may read.
  - **tenant_agreements**: a tenant has full read/write on `row.tenant_id = session.tenantId AND session.role = 'tenant'`; staff (property-scoped rule) get read-only, not write.
  - **tenant_documents**: `row.tenant_id = session.tenantId AND session.role = 'tenant'` may read.
  - **activity_log**: staff get read-only (no write path at all — writes are server-internal/audit-trail only, never user-initiated); `pg_id IS NULL` rows are platform-level events, readable only by super_admin.
  - **expense_categories**: super_admin also has explicit full read/write (redundant with the global rule, but the original had it stated per-table — no behavior difference).

## notifications
- Read: `row.recipient_id = session.userId` only.
- Update (marking read): `row.recipient_id = session.userId` only.
- No general staff/property-scoped access — this table is purely per-recipient.
- **Product-behavior gap, not just a schema one**: the live bell notification
  updates in real time via Supabase Realtime (0004) pushing new rows to the
  browser. MySQL has no equivalent — without building a polling or SSE/
  WebSocket mechanism separately, the bell will only update on page
  reload/refetch, not live.

## platform_invoices
- Full read/write: `super_admin` only (global rule covers this).
- Read-only: `session.role in ('admin','staff') AND row.pg_id ∈ session.propertyIds` (an owner reading their own PG's invoices).

## Not RLS-covered at all (no policy existed — writes are server-only)
`users`, `sessions` (new, replace Supabase Auth — see AUTH_DESIGN.md),
`tenant_counters` writes (only ever via the `next_tenant_no` procedure, never
direct user input).
