import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./auth";
import type { Role, SessionUser } from "./types";

/** Require an authenticated session in one of the allowed roles, else redirect. */
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
  return session;
}
