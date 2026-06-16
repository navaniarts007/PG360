"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { createClient } from "../supabase/server";

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
  const s = await createClient();
  const { error } = await s.from("floors").insert({ pg_id: pid, ...parsed.data });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/rooms");
  return { ok: true };
}

export async function updateFloorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const s = await createClient();
  const { error } = await s.from("floors").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/rooms");
  return { ok: true };
}

export async function deleteFloorAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const s = await createClient();
  const { count } = await s
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("floor_id", id);
  if ((count ?? 0) > 0) return; // floor still has rooms — block delete
  await s.from("floors").delete().eq("id", id);
  revalidatePath("/dashboard/rooms");
}
