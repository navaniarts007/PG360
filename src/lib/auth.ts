import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "./supabase/server";
import type { PropertyRef, Role, SessionUser } from "./types";

/* =========================================================================
   Session handling, backed by Supabase Auth + the profiles table.
   getSession() is request-cached so guards/layouts/pages share one lookup.
   Multi-property: admins/staff carry their property memberships + the
   cookie-selected active property; tenants stay single-property (pg_id).
   ========================================================================= */

const ACTIVE_PROPERTY_COOKIE = "pg360_active_property";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function loadProperties(
  supabase: SupabaseServer,
  role: Role,
  userId: string,
): Promise<PropertyRef[]> {
  if (role !== "admin" && role !== "staff") return [];
  const { data } = await supabase
    .from("property_members")
    .select("property_id, pg:pg_accounts(pg_name)")
    .eq("user_id", userId);
  type Row = { property_id: string; pg: { pg_name: string } | null };
  return ((data ?? []) as unknown as Row[])
    .map((m) => ({ id: m.property_id, name: m.pg?.pg_name ?? "Property" }))
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
  // no/invalid cookie: prefer the owner's "home" property, else the first
  if (pgId && properties.some((p) => p.id === pgId)) return pgId;
  return properties[0]?.id ?? null;
}

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, pg_id, full_name")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  const role = profile.role as Role;

  // Role-dependent lookups in parallel. The pg `status` is fetched here too, so
  // the per-page suspension check costs no extra round-trip (see requireRole).
  const [tenantRes, membersRes] = await Promise.all([
    role === "tenant"
      ? supabase
          .from("tenants")
          .select("id, pg:pg_accounts(status)")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    role === "admin" || role === "staff"
      ? supabase
          .from("property_members")
          .select("property_id, pg:pg_accounts(pg_name, status)")
          .eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
  ]);

  const tenantRow = tenantRes.data as { id: string; pg: { status: string } | null } | null;
  const tenant_id = role === "tenant" ? tenantRow?.id ?? null : null;

  type MRow = { property_id: string; pg: { pg_name: string; status: string } | null };
  const memberRows = (membersRes.data ?? []) as unknown as MRow[];
  const properties: PropertyRef[] = memberRows
    .map((m) => ({ id: m.property_id, name: m.pg?.pg_name ?? "Property" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const statusById = new Map(memberRows.map((m) => [m.property_id, m.pg?.status]));

  const activePropertyId = await resolveActiveProperty(role, profile.pg_id, properties);

  let suspended = false;
  if (role === "tenant") {
    suspended = tenantRow?.pg?.status === "suspended";
  } else if (role === "admin" || role === "staff") {
    suspended = activePropertyId ? statusById.get(activePropertyId) === "suspended" : false;
  }

  return {
    id: profile.id,
    role,
    pg_id: profile.pg_id,
    tenant_id,
    full_name: profile.full_name,
    email: user.email ?? "",
    properties,
    activePropertyId,
    suspended,
  };
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
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { ok: false, error: "Invalid email or password." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, pg_id, full_name")
    .eq("id", data.user.id)
    .single();
  if (!profile) {
    await supabase.auth.signOut();
    return { ok: false, error: "No PG360 profile is linked to this account." };
  }

  const role = profile.role as Role;
  let tenant_id: string | null = null;
  if (role === "tenant") {
    const { data: t } = await supabase
      .from("tenants")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    tenant_id = t?.id ?? null;
  }
  const properties = await loadProperties(supabase, role, data.user.id);
  const activePropertyId = await resolveActiveProperty(role, profile.pg_id, properties);

  return {
    ok: true,
    user: {
      id: profile.id,
      role,
      pg_id: profile.pg_id,
      tenant_id,
      full_name: profile.full_name,
      email: data.user.email ?? "",
      properties,
      activePropertyId,
      suspended: false, // freshly authenticated; the next page's getSession resolves it
    },
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
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
