# Replacing Supabase Auth

**Status: implemented** — `src/lib/auth.ts`, `src/lib/auth-actions.ts`,
`src/lib/mysql/client.ts`, `src/lib/mysql/session-token.ts`. What follows was
the proposal; the "Implementation notes" section at the end covers what
actually shipped, including two hardening details added while building it
that weren't in the original proposal (session tokens, brute-force lockout).

Supabase Auth (GoTrue) currently handles: password hashing, login,
session/JWT issuance, `auth.getUser()` on every request, password reset
emails, and the `auth.uid()` value RLS reads. None of it exists on plain
MySQL. Proposed replacement, scoped to be as small as this app actually
needs (no OAuth, no magic links currently used per `src/lib/auth.ts`):

- **Password hashing**: bcrypt (`bcryptjs` — no native build step, works
  fine in Next.js server actions/Node runtime).
- **Sessions**: server-side session rows in the new `sessions` table
  (`001_core_schema.sql`), referenced by a random opaque token in an
  httpOnly, secure, sameSite=lax cookie — not a JWT. Simpler to revoke
  (delete the row) and nothing meaningful to decode if stolen.
- **Session lookup**: a `getSession()` replacement that reads the cookie,
  looks up the session row (join to `users` + `profiles`, same shape
  `SessionUser` already expects in `src/lib/types.ts`), and rejects if
  expired. This is a drop-in replacement for the current
  `supabase.auth.getUser()` call in `src/lib/auth.ts:53` — the rest of
  `getSession()`'s logic (loading properties, impersonation cookie,
  active-property resolution) stays the same, since none of that is
  Supabase-specific.
- **Password reset**: currently via Supabase Auth's email flow
  (`src/app/(auth)/reset-password/page.tsx` + `/auth/callback`) — would
  need a hand-rolled version: generate a random token, store it with an
  expiry on a small `password_resets` table, email it via Resend (already
  a dependency), verify + rotate on submit.
- **Rate limiting on login**: Supabase Auth does this for you; a self-rolled
  version needs its own (even a simple per-IP/per-email attempt counter)
  before this goes anywhere near production, since brute-forcing a
  hand-rolled login endpoint is a realistic risk in a way it wasn't before.

This is a judgment call, not a mechanical translation like the schema was —
flag if you want a different approach (e.g. reusing a library like
Auth.js/NextAuth with a custom MySQL adapter instead of hand-rolling).

## Implementation notes (what actually shipped)

- **Session cookie**: `pg360_session`, httpOnly/secure-in-prod/sameSite=lax,
  30-day expiry. Holds a CSPRNG token (`crypto.randomBytes(32)`), not
  MySQL's `UUID()` — that function is version-1 (timestamp+MAC based), not
  safe as a bearer secret. Only the token's SHA-256 hash is stored, in
  `sessions.token_hash` (added to the schema after the original proposal —
  see `001_core_schema.sql`).
- **Brute-force lockout**: `users.failed_attempts` / `users.locked_until`.
  5 failed attempts locks the account for 15 minutes. This was the gap
  flagged in the original proposal ("needs its own rate limiting") — now
  built, not just noted.
- **Password reset**: `password_resets` table (`005_password_resets.sql`),
  same token/hash pattern as sessions, 1-hour expiry, single-use
  (`used_at`). Replaces Supabase's `resetPasswordForEmail` +
  `/auth/callback` code-exchange route entirely — that route is deleted on
  this branch (`src/app/auth/callback/route.ts`), since the new flow links
  straight to `/reset-password?token=...` with no intermediate exchange
  step. Emails go through the existing `src/lib/email.ts` (Resend) — no
  change needed there, it was already provider-agnostic.
- **Required env vars** (not committed — set locally in `.env.local` and on
  whatever hosts this branch's deployment): `MYSQL_HOST`, `MYSQL_PORT`,
  `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`.
- **Not done as part of this pass**: rewriting the ~26 files in
  `src/lib/actions/*.ts` plus `src/lib/db.ts` — those still call the
  Supabase client and will not work against MySQL yet. Auth alone doesn't
  make the app functional; it's the dependency everything else needed
  first.
