# PG360 · Supabase setup

The migrations here are the **production source of truth** for the schema and the
Row-Level-Security policies. The app ships demoable in-memory, but this is what powers
it for real.

## 1. Create a project

Create a Supabase project, then copy your keys into `.env.local` (see `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # server only, never shipped to the browser
```

## 2. Apply the migrations

With the Supabase CLI:

```bash
supabase db push
```

…or paste `migrations/0001_schema.sql` then `migrations/0002_rls.sql` into the SQL editor,
in that order.

## 3. Seed

```bash
# creates real auth users + a demo PG with rooms/tenants/payments/issues
node --env-file=.env.local scripts/seed.mjs
```

(`seed.sql` seeds only the business tables — useful for a quick look as the service role;
the script above also creates the auth logins, which is what you want.)

## 4. Point the app at Supabase

1. The typed clients already exist: `src/lib/supabase/server.ts` (RSC / actions) and
   `src/lib/supabase/client.ts` (browser).
2. `isSupabaseConfigured()` is true once the env vars are set.
3. Replace the in-memory calls in `src/lib/store.ts` with Supabase queries (the function
   signatures map 1:1 to the tables), and swap `src/lib/auth.ts` for Supabase Auth.
   Generate DB types with `supabase gen types typescript` for end-to-end typing.

## Security model (enforced by RLS, not the UI)

| Role          | Can do                                                                 |
| ------------- | --------------------------------------------------------------------- |
| `super_admin` | manage `pg_accounts`, read platform-wide aggregates                   |
| `admin`/`staff` | full CRUD only where `pg_id = current_pg_id()`                       |
| `tenant`      | read their own room/pg/payments; insert issues as themselves only     |

Helper functions `current_role()`, `current_pg_id()`, `current_tenant_id()` resolve the
caller's identity from `profiles` / `tenants` and are used throughout the policies.

### Verifying isolation (PG A cannot read PG B)

Sign in as the `admin` of PG A and query `tenants` / `payments` — you will only ever see
rows where `pg_id` is your PG. The same query as PG B's admin returns a disjoint set.
Tenants are scoped further to their own rows.
