"use server";

import { revalidatePath } from "next/cache";
import { humanizeDbError } from "../errors";
import { z } from "zod";
import { requireRole } from "../guards";
import { canDelete, canEdit } from "../perms";
import { getActiveProperty } from "../auth";
import { query, queryOne } from "../mysql/client";
import { notifyStaff } from "../notify";

export type ActionState = { ok?: boolean; error?: string };

const bookingSchema = z.object({
  pg_id: z.string().uuid("Invalid PG."),
  tenant_name: z.string().min(2, "Enter your name."),
  phone: z.string().min(8, "Enter a valid phone."),
  preferred_room_type: z.enum(["single", "double", "triple", "any"]),
  requested_date: z.string().optional(),
  notes: z.string().optional(),
});

/** PUBLIC: anyone can submit a room request — no session required, matching
 *  the original's "insert via the service client" design (there is no RLS
 *  vs. service-client distinction in MySQL; this is just an unauthenticated
 *  insert after validating the target PG exists and is active). */
export async function createBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  const pg = await queryOne<{ id: string; status: string }>(
    `select id, status from pg_accounts where id = ?`,
    [d.pg_id],
  );
  if (!pg || pg.status !== "active") return { error: "This PG isn't accepting requests." };

  try {
    await query(
      `insert into bookings (pg_id, tenant_name, phone, preferred_room_type, requested_date, notes)
       values (?, ?, ?, ?, ?, ?)`,
      [d.pg_id, d.tenant_name, d.phone, d.preferred_room_type, d.requested_date || null, d.notes || null],
    );
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }

  await notifyStaff(
    d.pg_id,
    `New room request from ${d.tenant_name} (${d.preferred_room_type})`,
    "/dashboard/bookings",
  );
  return { ok: true };
}

export async function setBookingStatusAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["pending", "approved", "rejected"].includes(status)) return;
  await query(`update bookings set status = ? where id = ? and pg_id = ?`, [status, id, pid]);
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
}

const bookingUpdateSchema = z.object({
  tenant_name: z.string().min(2, "Enter a name."),
  phone: z.string().min(8, "Enter a valid phone."),
  preferred_room_type: z.enum(["single", "double", "triple", "any"]),
  requested_date: z.string().optional(),
  notes: z.string().optional(),
});

export async function updateBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["admin", "staff"]);
  if (!canEdit(me)) return { error: "You don't have permission to edit." };
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const id = String(formData.get("id"));
  const parsed = bookingUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  await query(
    `update bookings set tenant_name = ?, phone = ?, preferred_room_type = ?, requested_date = ?, notes = ?
      where id = ? and pg_id = ?`,
    [d.tenant_name, d.phone, d.preferred_room_type, d.requested_date || null, d.notes || null, id, pid],
  );
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteBookingAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "staff"]);
  if (!canDelete(me)) return;
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  await query(`delete from bookings where id = ? and pg_id = ?`, [id, pid]);
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
}
