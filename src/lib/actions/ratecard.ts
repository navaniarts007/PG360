"use server";

import { revalidatePath } from "next/cache";
import { humanizeDbError } from "../errors";
import { z } from "zod";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { createClient } from "../supabase/server";

export type ActionState = { ok?: boolean; error?: string };

const schema = z.object({
  name: z.string().min(2, "Name is required."),
  room_type: z.enum(["single", "double", "triple", "quad", "dorm"]),
  ac: z.enum(["true", "false"]).optional(),
  bath_type: z.enum(["attached", "common"]),
  price_per_month: z.coerce.number().min(0, "Enter a price."),
  food_included: z.enum(["true", "false"]).optional(),
  food_opt_out_deduction: z.coerce.number().min(0).optional(),
});

function parseRow(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  return {
    row: {
      name: d.name,
      room_type: d.room_type,
      ac: d.ac === "true",
      bath_type: d.bath_type,
      price_per_month: d.price_per_month,
      food_included: d.food_included !== "false",
      food_opt_out_deduction: d.food_opt_out_deduction ?? 0,
    },
  };
}

export async function createRateCardAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const res = parseRow(formData);
  if ("error" in res) return { error: res.error };
  const s = await createClient();
  const { error } = await s.from("rate_cards").insert({ pg_id: pid, ...res.row });
  if (error) {
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "A rate card with the same type, AC, bath and price already exists."
        : error.message,
    };
  }
  revalidatePath("/dashboard/pricing");
  return { ok: true };
}

export async function updateRateCardAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const res = parseRow(formData);
  if ("error" in res) return { error: res.error };
  const s = await createClient();
  const { error } = await s.from("rate_cards").update(res.row).eq("id", id);
  if (error) return { error: humanizeDbError(error) };
  // keep beds on this card in sync with the new price
  await s.from("beds").update({ price_per_month: res.row.price_per_month }).eq("rate_card_id", id);
  revalidatePath("/dashboard/pricing");
  revalidatePath("/dashboard/rooms");
  return { ok: true };
}

export async function deleteRateCardAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const s = await createClient();
  const { count } = await s
    .from("beds")
    .select("id", { count: "exact", head: true })
    .eq("rate_card_id", id);
  if ((count ?? 0) > 0) return; // in use by beds — block delete
  await s.from("rate_cards").delete().eq("id", id);
  revalidatePath("/dashboard/pricing");
}
