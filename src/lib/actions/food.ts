"use server";

import { revalidatePath } from "next/cache";
import { humanizeDbError } from "../errors";
import { z } from "zod";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { query } from "../mysql/client";

export type ActionState = { ok?: boolean; error?: string };

const MEALS = ["breakfast", "lunch", "dinner"] as const;

/** Admin saves the whole weekly menu (21 cells: 7 days x 3 meals). */
export async function saveFoodMenuAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };

  const rows: [string, number, string, string][] = [];
  for (let day = 0; day < 7; day++) {
    for (const meal of MEALS) {
      const desc = String(formData.get(`d${day}_${meal}`) ?? "").trim();
      rows.push([pid, day, meal, desc]);
    }
  }
  try {
    const placeholders = rows.map(() => "(?,?,?,?)").join(",");
    await query(
      `insert into food_menu (pg_id, day_of_week, meal_type, description) values ${placeholders}
       on duplicate key update description = values(description)`,
      rows.flat(),
    );
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }
  revalidatePath("/dashboard/food");
  revalidatePath("/portal/food");
  return { ok: true };
}

const optSchema = z.object({
  date: z.string().min(1),
  meal_type: z.enum(["breakfast", "lunch", "dinner"]),
  opted_in: z.enum(["true", "false"]),
});

/** Tenant toggles a single meal opt in/out. */
export async function toggleFoodOptAction(formData: FormData): Promise<void> {
  const me = await requireRole(["tenant"]);
  if (!me.tenant_id || !me.pg_id) return;
  const parsed = optSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await query(
    `insert into food_opt (pg_id, tenant_id, opt_date, meal_type, opted_in) values (?, ?, ?, ?, ?)
     on duplicate key update opted_in = values(opted_in)`,
    [me.pg_id, me.tenant_id, parsed.data.date, parsed.data.meal_type, parsed.data.opted_in === "true"],
  );
  revalidatePath("/portal/food");
}
