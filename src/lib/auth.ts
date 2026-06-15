import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Role, SessionUser } from "./types";

/* =========================================================================
   Session handling, backed by Supabase Auth + the profiles table.
   getSession() is request-cached so guards/layouts/pages share one lookup.
   ========================================================================= */

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

  let tenant_id: string | null = null;
  if (profile.role === "tenant") {
    const { data: t } = await supabase
      .from("tenants")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    tenant_id = t?.id ?? null;
  }

  return {
    id: profile.id,
    role: profile.role as Role,
    pg_id: profile.pg_id,
    tenant_id,
    full_name: profile.full_name,
    email: user.email ?? "",
  };
});

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

  let tenant_id: string | null = null;
  if (profile.role === "tenant") {
    const { data: t } = await supabase
      .from("tenants")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    tenant_id = t?.id ?? null;
  }

  return {
    ok: true,
    user: {
      id: profile.id,
      role: profile.role as Role,
      pg_id: profile.pg_id,
      tenant_id,
      full_name: profile.full_name,
      email: data.user.email ?? "",
    },
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
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
