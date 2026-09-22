import "server-only";
import { query } from "./mysql/client";
import type { Role } from "./types";

/* =========================================================================
   Notification creation. Best-effort: failures here never block the primary
   action.
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
    const placeholders = list.map(() => "(?,?,?,?,?)").join(",");
    const params = list.flatMap((n) => [n.pgId, n.recipientId, n.recipientType, n.message, n.link ?? null]);
    await query(
      `insert into notifications (pg_id, recipient_id, recipient_type, message, link) values ${placeholders}`,
      params,
    );
  } catch {
    /* best-effort */
  }
}

/** ids of the admins/staff whose home property is this PG. */
export async function pgStaffUserIds(pgId: string): Promise<{ id: string; role: Role }[]> {
  return query<{ id: string; role: Role }>(
    `select id, role from profiles where pg_id = ? and role in ('admin', 'staff')`,
    [pgId],
  );
}

/** the user id behind a tenant row (their login), if any. */
export async function tenantUserId(tenantId: string): Promise<string | null> {
  const row = await query<{ user_id: string | null }>(`select user_id from tenants where id = ?`, [
    tenantId,
  ]);
  return row[0]?.user_id ?? null;
}

/** notify all staff of a PG. */
export async function notifyStaff(pgId: string, message: string, link?: string): Promise<void> {
  const staff = await pgStaffUserIds(pgId);
  await notify(staff.map((s) => ({ pgId, recipientId: s.id, recipientType: s.role, message, link })));
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
