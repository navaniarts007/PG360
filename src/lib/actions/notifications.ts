"use server";

import { requireRole } from "../guards";
import { getSession } from "../auth";
import { query } from "../mysql/client";
import type { AppNotification } from "../types";

/** Mark the caller's unread notifications as read. Original relied entirely
 *  on RLS ("RLS scopes to recipient") with no explicit filter — that's gone,
 *  so this now explicitly scopes to recipient_id = the caller's own id. */
export async function markAllNotificationsReadAction(): Promise<void> {
  await requireRole(["super_admin", "admin", "staff", "tenant"]);
  const session = await getSession();
  if (!session) return;
  await query(`update notifications set is_read = true where recipient_id = ? and is_read = false`, [
    session.id,
  ]);
}

/** Polling replacement for the original Supabase Realtime `postgres_changes`
 *  subscription (no MySQL equivalent) — the bell calls this on an interval
 *  instead of getting pushed live updates. Scoped to the caller's own id,
 *  same as getMyNotifications() in db.ts. */
export async function fetchMyNotificationsAction(limit = 20): Promise<AppNotification[]> {
  const session = await getSession();
  if (!session) return [];
  return query<AppNotification>(
    `select * from notifications where recipient_id = ? order by created_at desc limit ?`,
    [session.id, limit],
  );
}
