import "server-only";
import { query } from "./mysql/client";
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
    const pgId = opts && "pgId" in opts ? opts.pgId : s?.activePropertyId ?? s?.pg_id ?? null;
    await query(
      `insert into activity_log (pg_id, actor_id, actor_name, actor_role, action, detail)
       values (?, ?, ?, ?, ?, ?)`,
      [
        pgId ?? null,
        s?.id ?? null,
        s?.full_name ?? null,
        s?.impersonating ? "super_admin (as owner)" : s?.role ?? null,
        action,
        detail,
      ],
    );
  } catch {
    /* best-effort */
  }
}
