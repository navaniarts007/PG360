import "server-only";
import { createAdminClient } from "./supabase/admin";
import { getSession } from "./auth";

/** Record an activity-log entry. Best-effort — never blocks the primary action.
 *  Defaults the actor to the current session and pg to their active property;
 *  pass `pgId: null` for a platform-level event, or an explicit pgId. */
export async function logActivity(
  action: string,
  detail: string,
  opts?: { pgId?: string | null },
): Promise<void> {
  try {
    const s = await getSession();
    const pgId =
      opts && "pgId" in opts ? opts.pgId : s?.activePropertyId ?? s?.pg_id ?? null;
    const admin = createAdminClient();
    await admin.from("activity_log").insert({
      pg_id: pgId ?? null,
      actor_id: s?.id ?? null,
      actor_name: s?.full_name ?? null,
      actor_role: s?.impersonating ? "super_admin (as owner)" : s?.role ?? null,
      action,
      detail,
    });
  } catch {
    /* best-effort */
  }
}
