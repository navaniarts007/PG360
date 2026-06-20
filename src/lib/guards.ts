import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./auth";
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

  // suspension gate — resolved once in getSession (no extra round-trip here)
  if (session.role !== "super_admin" && session.suspended) redirect("/suspended");

  return session;
}
