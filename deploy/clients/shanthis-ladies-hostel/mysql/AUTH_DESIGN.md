# Replacing Supabase Auth (proposed default — confirm before building)

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
Auth.js/NextAuth with a custom MySQL adapter instead of hand-rolling)
before this gets built out.
