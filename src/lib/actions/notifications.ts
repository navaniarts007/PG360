"use server";

import { requireRole } from "../guards";
import { createClient } from "../supabase/server";

/** Mark the caller's unread notifications as read (RLS scopes to recipient). */
export async function markAllNotificationsReadAction(): Promise<void> {
  await requireRole(["super_admin", "admin", "staff", "tenant"]);
  const s = await createClient();
  await s.from("notifications").update({ is_read: true }).eq("is_read", false);
}
