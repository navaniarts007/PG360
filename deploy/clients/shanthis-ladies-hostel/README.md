# Shanthi Ladies Hostel — DB/storage migration

Scoped to this client only. Does not affect the main PG360 product, its Supabase
project, or the `main` branch. Everything here lives under `deploy/clients/`.

**Active plan: `mysql/`.** The OVI Panel account has no confirmed root/SSH
(Terminal wouldn't connect), and only self-serves MySQL — not Postgres/Docker
— so self-hosting Supabase (below) isn't achievable on this hosting as-is.
`mysql/` translates the full schema to MySQL 8.0.36 (confirmed VPS version)
with Supabase Auth/RLS replaced by application-layer equivalents — see
`mysql/001_core_schema.sql`, `mysql/002_new_tables.sql`,
`mysql/003_alter_core_tables.sql`, `mysql/004_counters_and_functions.sql` in
that order, and read `mysql/RLS_TO_APP_LAYER.md` +
`mysql/AUTH_DESIGN.md` before writing any server action against it.

Everything below this point (`schema-clone.sql`) is the **fallback path** —
kept in case root/Docker access ever becomes available on this VPS or a
different one, since it needs far less rewriting (same Postgres dialect, RLS
intact). Not the current direction.

## What's actually being cloned

The live Supabase project (`qlfltufpebcwlefvxuwz`, Mumbai) is **PostgreSQL 17.6**,
not 16 — match that version, not 16, for a true exact clone.

`schema-clone.sql` in this folder is every migration under `supabase/migrations/`
(0001 through 0038) concatenated in order. It is **not** plain-Postgres-portable:

- Row Level Security policies call `auth.uid()` and reference `auth.users`
  (created by Supabase Auth / GoTrue) — see `0002_rls.sql` and most tables after it.
- `0004_realtime.sql` adds `public.notifications` to the `supabase_realtime`
  publication (created by Supabase Realtime).
- `0019_kyc_bucket.sql` inserts a row into `storage.buckets` (created by
  Supabase Storage). KYC/Aadhaar documents live here as a **private** bucket,
  served only via signed URLs from the service role — this is the one file
  category that is NOT on Cloudinary. Everything else (payment screenshots,
  QR codes, avatars, general docs) is Cloudinary.

Running `schema-clone.sql` against a bare `postgres:17` install will fail on
the first `auth.uid()` / `storage.buckets` reference. There is no way around
this short of hand-rewriting ~19 migration files' worth of RLS policies — not
something to do as a "first step."

## Prerequisite: root/SSH on the VPS

The OVI Panel account (`shanthisladiesho`) checked so far does not have
confirmed root — its Terminal didn't connect, and the panel's own UI only
self-serves MySQL, not Postgres. Self-hosting Supabase needs:

- Root or sudo SSH access
- Docker + Docker Compose (or the resources/permission to install them)
- Enough RAM for Postgres + GoTrue + PostgREST + Storage + Realtime + Kong
  (Supabase's own self-hosting docs suggest 4GB+ as a practical minimum)
- Outbound network access for the containers to pull images on first run

**Nothing below this line should be attempted until that access is confirmed.**

## Once root access exists — setup outline

1. Install Docker + Docker Compose on the VPS.
2. Clone Supabase's official self-hosting Docker Compose stack
   (`supabase/supabase` repo, `docker/` directory) — this provisions
   Postgres 17 + GoTrue + PostgREST + Storage + Realtime + Kong together,
   which is what actually makes `auth.*` / `storage.*` / `supabase_realtime`
   exist.
3. Set the stack's Postgres image tag to match 17.6, and set strong
   generated secrets (JWT secret, anon/service keys, DB password) — these
   become this client's own Supabase-equivalent keys, entirely separate from
   the main product's `qlfltufpebcwlefvxuwz` project.
4. Bring the stack up, confirm Studio/API respond locally.
5. Run `schema-clone.sql` against the stack's Postgres (now that `auth`/
   `storage` schemas exist) — via `psql` or the Studio SQL editor.
6. Re-create the `kyc` private bucket policy check (0019) and confirm signed
   URLs work against the self-hosted Storage API.
7. Only then: point this client's app deployment env vars
   (`NEXT_PUBLIC_SUPABASE_URL`, anon key, service role key) at the
   self-hosted instance instead of the managed Supabase Cloud project.
8. Decide firewall posture for remote access (this VPS's Postgres/Storage
   need to be reachable from wherever this client's app deployment runs) —
   flagged here as a decision, not yet made.

## Explicitly not done yet

- No data has been copied — this is schema only. Copying actual tenant/
  payment/KYC data is a separate, deliberately-scoped step once the schema
  is confirmed working, and needs its own plan for do-not-lose-data safety.
- No app code changes yet.
- No production credentials touched — this whole folder was built from the
  local `supabase/migrations/*.sql` files already in the repo, plus one
  read-only `select version();` against the existing Supabase project.
