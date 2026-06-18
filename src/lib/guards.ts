import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./auth";
import { createClient } from "./supabase/server";
import type { Role, SessionUser } from "./types";

/** Require an authenticated session in one of the allowed roles, else redirect.
 *  Also blocks access when the relevant PG is suspended (super_admin exempt). */
export async function requireRole(allowed: Role[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!allowed.includes(session.role)) {
    // signed in but wrong area — send them to their own home
    switch (session.role) {
      case "super_admin":
        redirect("/platform");
      case "tenant":
        redirect("/portal");
      default:
        redirect("/dashboard");
    }
  }

  // suspension gate — a suspended PG locks out its owner/staff/tenants
  if (session.role !== "super_admin") {
    const pgId = session.role === "tenant" ? session.pg_id : session.activePropertyId;
    if (pgId) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("pg_accounts")
        .select("status")
        .eq("id", pgId)
        .maybeSingle();
      if (data?.status === "suspended") redirect("/suspended");
    }
  }

  return session;
}
