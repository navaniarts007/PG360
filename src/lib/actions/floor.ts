"use server";

import { revalidatePath } from "next/cache";
import { humanizeDbError } from "../errors";
import { z } from "zod";
import { requireRole } from "../guards";
import { canDelete, canEdit } from "../perms";
import { getActiveProperty } from "../auth";
import { query, queryOne } from "../mysql/client";

export type ActionState = { ok?: boolean; error?: string };

const schema = z.object({
  name: z.string().min(1, "Floor name is required."),
  sort_order: z.coerce.number().int().default(0),
});

export async function createFloorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    await query(`insert into floors (pg_id, name, sort_order) values (?, ?, ?)`, [
      pid,
      parsed.data.name,
      parsed.data.sort_order,
    ]);
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }
  revalidatePath("/dashboard/rooms");
  return { ok: true };
}

export async function updateFloorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["admin", "staff"]);
  if (!canEdit(me)) return { error: "You don't have permission to edit." };
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const id = String(formData.get("id"));
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    // pg_id = ? here is the fix: the original had no explicit property check
    // at all (`.eq("id", id)` only, relying entirely on RLS) — without it,
    // any admin/staff from ANY property could edit another property's floor
    // by id. Same class of gap as the read-side "getMy*" functions, but on
    // a write path.
    await query(`update floors set name = ?, sort_order = ? where id = ? and pg_id = ?`, [
      parsed.data.name,
      parsed.data.sort_order,
      id,
      pid,
    ]);
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }
  revalidatePath("/dashboard/rooms");
  return { ok: true };
}

export async function deleteFloorAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "staff"]);
  if (!canDelete(me)) return;
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  const row = await queryOne<{ n: number }>(`select count(*) as n from rooms where floor_id = ?`, [id]);
  if ((row?.n ?? 0) > 0) return; // floor still has rooms — block delete
  await query(`delete from floors where id = ? and pg_id = ?`, [id, pid]);
  revalidatePath("/dashboard/rooms");
}
