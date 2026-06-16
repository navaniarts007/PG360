import "server-only";
import { createAdminClient } from "./supabase/admin";
import type { Role } from "./types";

/* =========================================================================
   Notification creation. Inserts run via the service client (bypasses RLS),
   always targeting a specific recipient auth user. Best-effort: failures here
   never block the primary action.
   ========================================================================= */

interface NotifyInput {
  pgId: string;
  recipientId: string;
  recipientType: Role;
  message: string;
  link?: string;
}

export async function notify(input: NotifyInput | NotifyInput[]): Promise<void> {
  const list = Array.isArray(input) ? input : [input];
  if (list.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert(
      list.map((n) => ({
        pg_id: n.pgId,
        recipient_id: n.recipientId,
        recipient_type: n.recipientType,
        message: n.message,
        link: n.link ?? null,
      })),
    );
  } catch {
    /* best-effort */
  }
}

/** auth user ids of the admins/staff running a PG. */
export async function pgStaffUserIds(
  pgId: string,
): Promise<{ id: string; role: Role }[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, role")
    .eq("pg_id", pgId)
    .in("role", ["admin", "staff"]);
  return (data ?? []) as { id: string; role: Role }[];
}

/** the auth user id behind a tenant row (their login), if any. */
export async function tenantUserId(tenantId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("user_id")
    .eq("id", tenantId)
    .maybeSingle();
  return (data?.user_id as string) ?? null;
}

/** notify all staff of a PG. */
export async function notifyStaff(
  pgId: string,
  message: string,
  link?: string,
): Promise<void> {
  const staff = await pgStaffUserIds(pgId);
  await notify(
    staff.map((s) => ({
      pgId,
      recipientId: s.id,
      recipientType: s.role,
      message,
      link,
    })),
  );
}

/** notify a tenant (if they have a login). */
export async function notifyTenant(
  pgId: string,
  tenantId: string,
  message: string,
  link?: string,
): Promise<void> {
  const uid = await tenantUserId(tenantId);
  if (!uid) return;
  await notify({ pgId, recipientId: uid, recipientType: "tenant", message, link });
}
