"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { query, queryOne } from "../mysql/client";
import { humanizeDbError } from "../errors";

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
  try {
    await query(
      `insert into rate_cards (pg_id, name, room_type, ac, bath_type, price_per_month, food_included, food_opt_out_deduction)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pid,
        res.row.name,
        res.row.room_type,
        res.row.ac,
        res.row.bath_type,
        res.row.price_per_month,
        res.row.food_included,
        res.row.food_opt_out_deduction,
      ],
    );
  } catch (error) {
    const msg = (error as { message?: string })?.message ?? "";
    return {
      // Keep the friendly duplicate-specific message, but never surface the
      // raw mysql2 message otherwise — that can expose table/column/
      // constraint details, which contradicts humanizeDbError's no-SQL-
      // jargon-to-the-user contract used everywhere else in this file.
      error: /duplicate|unique/i.test(msg)
        ? "A rate card with the same type, AC, bath and price already exists."
        : humanizeDbError(error as never),
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
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const id = String(formData.get("id"));
  const res = parseRow(formData);
  if ("error" in res) return { error: res.error };

  // pg_id = ? fixes a cross-tenant write gap the original had.
  await query(
    `update rate_cards set name = ?, room_type = ?, ac = ?, bath_type = ?, price_per_month = ?,
            food_included = ?, food_opt_out_deduction = ?
      where id = ? and pg_id = ?`,
    [
      res.row.name,
      res.row.room_type,
      res.row.ac,
      res.row.bath_type,
      res.row.price_per_month,
      res.row.food_included,
      res.row.food_opt_out_deduction,
      id,
      pid,
    ],
  );
  // keep beds on this card in sync with the new price
  await query(`update beds set price_per_month = ? where rate_card_id = ? and pg_id = ?`, [
    res.row.price_per_month,
    id,
    pid,
  ]);
  revalidatePath("/dashboard/pricing");
  revalidatePath("/dashboard/rooms");
  return { ok: true };
}

export async function deleteRateCardAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  const row = await queryOne<{ n: number }>(`select count(*) as n from beds where rate_card_id = ?`, [
    id,
  ]);
  if ((row?.n ?? 0) > 0) return; // in use by beds — block delete
  await query(`delete from rate_cards where id = ? and pg_id = ?`, [id, pid]);
  revalidatePath("/dashboard/pricing");
}
