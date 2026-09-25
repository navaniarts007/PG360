import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { query, queryOne, parseJsonColumn } from "./mysql/client";
import { generateSessionToken, hashToken } from "./mysql/session-token";
import type { PropertyRef, Role, SessionUser, StaffPermissions } from "./types";

/* =========================================================================
   Session handling for the Shanthi Ladies Hostel branch — replaces Supabase
   Auth + RLS with bcrypt + opaque session cookies against MySQL. Every check
   Postgres RLS used to enforce automatically is now done explicitly in here
   and in guards.ts / requireRole. See deploy/clients/shanthis-ladies-hostel/
   mysql/RLS_TO_APP_LAYER.md and AUTH_DESIGN.md for the source of truth.

   getSession() is request-cached so guards/layouts/pages share one lookup.
   Multi-property: admins/staff carry their property memberships + the
   cookie-selected active property; tenants stay single-property (pg_id).
   ========================================================================= */

const SESSION_COOKIE = "pg360_session";
const ACTIVE_PROPERTY_COOKIE = "pg360_active_property";
const IMPERSONATE_COOKIE = "pg360_impersonate";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

async function loadProperties(role: Role, userId: string): Promise<PropertyRef[]> {
  if (role !== "admin" && role !== "staff") return [];
  const rows = await query<{ property_id: string; pg_name: string }>(
    `select pm.property_id, pa.pg_name
       from property_members pm
       join pg_accounts pa on pa.id = pm.property_id
      where pm.user_id = ?`,
    [userId],
  );
  return rows
    .map((r) => ({ id: r.property_id, name: r.pg_name ?? "Property" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function resolveActiveProperty(
  role: Role,
  pgId: string | null,
  properties: PropertyRef[],
): Promise<string | null> {
  if (role === "tenant") return pgId;
  if (properties.length === 0) return pgId;
  const store = await cookies();
  const picked = store.get(ACTIVE_PROPERTY_COOKIE)?.value;
  if (picked && properties.some((p) => p.id === picked)) return picked;
  if (pgId && properties.some((p) => p.id === pgId)) return pgId;
  return properties[0]?.id ?? null;
}

export const getSession = cache(async (): Promise<SessionUser | null> => {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const row = await queryOne<{
      user_id: string;
      email: string;
      profile_id: string;
      role: Role;
      pg_id: string | null;
      full_name: string;
      terms_accepted_at: Date | null;
      permissions: StaffPermissions | null;
    }>(
      `select u.id as user_id, u.email,
              p.id as profile_id, p.role, p.pg_id, p.full_name,
              p.terms_accepted_at, p.permissions
         from sessions s
         join users u on u.id = s.user_id
         join profiles p on p.id = u.id
        where s.token_hash = ? and s.expires_at > now()`,
      [hashToken(token)],
    );
    if (!row) return null;

    const role = row.role;
    const termsAcceptedAt = row.terms_accepted_at ? new Date(row.terms_accepted_at).toISOString() : null;
    const permissions = parseJsonColumn<StaffPermissions | null>(row.permissions, null);

    // Super-admin "open / view as": present an effective admin session scoped
    // to the impersonated PG. Every write path must still check the REAL role
    // via getSession() server-side before allowing an action — this object
    // alone is what the UI renders, not a capability grant by itself.
    if (role === "super_admin") {
      const impersonatePgId = store.get(IMPERSONATE_COOKIE)?.value;
      if (impersonatePgId) {
        const pg = await queryOne<{ pg_name: string }>(
          `select pg_name from pg_accounts where id = ?`,
          [impersonatePgId],
        );
        if (pg) {
          return {
            id: row.profile_id,
            role: "admin",
            pg_id: impersonatePgId,
            tenant_id: null,
            full_name: row.full_name,
            email: row.email,
            properties: [{ id: impersonatePgId, name: pg.pg_name }],
            activePropertyId: impersonatePgId,
            suspended: false,
            impersonating: { pgId: impersonatePgId, pgName: pg.pg_name },
            termsAcceptedAt: new Date().toISOString(),
          };
        }
      }
    }

    const [tenantRow, memberRows] = await Promise.all([
      role === "tenant"
        ? queryOne<{ id: string; pg_status: string }>(
            `select t.id, pa.status as pg_status
               from tenants t
               join pg_accounts pa on pa.id = t.pg_id
              where t.user_id = ?
              limit 1`,
            [row.user_id],
          )
        : Promise.resolve(null),
      role === "admin" || role === "staff"
        ? query<{ property_id: string; pg_name: string; status: string }>(
            `select pm.property_id, pa.pg_name, pa.status
               from property_members pm
               join pg_accounts pa on pa.id = pm.property_id
              where pm.user_id = ?`,
            [row.user_id],
          )
        : Promise.resolve([]),
    ]);

    const tenant_id = role === "tenant" ? tenantRow?.id ?? null : null;

    const properties: PropertyRef[] = memberRows
      .map((m) => ({ id: m.property_id, name: m.pg_name ?? "Property" }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const statusById = new Map(memberRows.map((m) => [m.property_id, m.status]));

    const activePropertyId = await resolveActiveProperty(role, row.pg_id, properties);

    let suspended = false;
    if (role === "tenant") {
      suspended = tenantRow?.pg_status === "suspended";
    } else if (role === "admin" || role === "staff") {
      suspended = activePropertyId ? statusById.get(activePropertyId) === "suspended" : false;
    }

    return {
      id: row.profile_id,
      role,
      pg_id: row.pg_id,
      tenant_id,
      full_name: row.full_name,
      email: row.email,
      properties,
      activePropertyId,
      suspended,
      termsAcceptedAt,
      permissions,
    };
  } catch {
    return null;
  }
});

/** The property an admin/staff is currently scoped to (for queries/writes). */
export async function getActiveProperty(): Promise<string | null> {
  const session = await getSession();
  return session?.activePropertyId ?? null;
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const genericError = "Invalid email or password.";

  const row = await queryOne<{
    id: string;
    email: string;
    password_hash: string;
    failed_attempts: number;
    locked_until: Date | null;
    profile_id: string;
    role: Role;
    pg_id: string | null;
    full_name: string;
  }>(
    `select u.id, u.email, u.password_hash, u.failed_attempts, u.locked_until,
            p.id as profile_id, p.role, p.pg_id, p.full_name
       from users u
       join profiles p on p.id = u.id
      where u.email = ?`,
    [email.trim().toLowerCase()],
  );

  // Constant-shape response whether or not the email exists, to avoid
  // leaking account existence via timing/response differences.
  const hash = row?.password_hash ?? "$2a$10$invalidsaltinvalidsaltinvalidsaltinvalidsa";
  if (row?.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    return { ok: false, error: "Too many failed attempts. Try again in a few minutes." };
  }

  const valid = await bcrypt.compare(password, hash);
  if (!row || !valid) {
    if (row) {
      // Atomic increment: the old read-modify-write (read failed_attempts,
      // compute +1, write it back) let concurrent wrong-password requests
      // all read the same starting value and overwrite each other's
      // increment, undercounting attempts and letting an attacker bypass the
      // lockout by firing guesses in parallel. Doing the +1 and the lockout
      // decision in the UPDATE itself makes MySQL's row lock serialize it.
      const lockedUntil = new Date(Date.now() + LOCKOUT_MS);
      await query(
        `update users
            set failed_attempts = failed_attempts + 1,
                locked_until = case when failed_attempts + 1 >= ? then ? else locked_until end
          where id = ?`,
        [MAX_FAILED_ATTEMPTS, lockedUntil, row.id],
      );
    }
    return { ok: false, error: genericError };
  }

  await query(`update users set failed_attempts = 0, locked_until = null where id = ?`, [row.id]);

  const role = row.role;
  let tenant_id: string | null = null;
  if (role === "tenant") {
    const t = await queryOne<{ id: string }>(
      `select id from tenants where user_id = ? limit 1`,
      [row.id],
    );
    tenant_id = t?.id ?? null;
  }
  const properties = await loadProperties(role, row.id);
  const activePropertyId = await resolveActiveProperty(role, row.pg_id, properties);

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(`insert into sessions (user_id, token_hash, expires_at) values (?, ?, ?)`, [
    row.id,
    hashToken(token),
    expiresAt,
  ]);

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return {
    ok: true,
    user: {
      id: row.profile_id,
      role,
      pg_id: row.pg_id,
      tenant_id,
      full_name: row.full_name,
      email: row.email,
      properties,
      activePropertyId,
      suspended: false, // freshly authenticated; the next page's getSession resolves it
    },
  };
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await query(`delete from sessions where token_hash = ?`, [hashToken(token)]);
  }
  store.delete(SESSION_COOKIE);
}

export async function setActiveProperty(propertyId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_PROPERTY_COOKIE, propertyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Super-admin starts/stops "open / view as" for a PG. */
export async function setImpersonation(pgId: string): Promise<void> {
  const store = await cookies();
  store.set(IMPERSONATE_COOKIE, pgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 6, // a working session; cleared on exit
  });
}

export async function clearImpersonation(): Promise<void> {
  const store = await cookies();
  store.delete(IMPERSONATE_COOKIE);
}

/** Landing path for a given role after login. */
export function homeForRole(role: Role): string {
  switch (role) {
    case "super_admin":
      return "/platform";
    case "admin":
    case "staff":
      return "/dashboard";
    case "tenant":
      return "/portal";
  }
}
