"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "../guards";
import { createClient } from "../supabase/server";

export type ActionState = { ok?: boolean; error?: string };

const MEALS = ["breakfast", "lunch", "dinner"] as const;

/** Admin saves the whole weekly menu (21 cells: 7 days × 3 meals). */
export async function saveFoodMenuAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["admin", "staff"]);
  if (!me.pg_id) return { error: "No PG attached to your account." };
  const s = await createClient();

  const rows: {
    pg_id: string;
    day_of_week: number;
    meal_type: string;
    description: string;
  }[] = [];
  for (let day = 0; day < 7; day++) {
    for (const meal of MEALS) {
      const desc = String(formData.get(`d${day}_${meal}`) ?? "").trim();
      rows.push({
        pg_id: me.pg_id,
        day_of_week: day,
        meal_type: meal,
        description: desc,
      });
    }
  }
  const { error } = await s
    .from("food_menu")
    .upsert(rows, { onConflict: "pg_id,day_of_week,meal_type" });
  if (error) return { error: error.message };
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
  const s = await createClient();
  await s.from("food_opt").upsert(
    {
      pg_id: me.pg_id,
      tenant_id: me.tenant_id,
      date: parsed.data.date,
      meal_type: parsed.data.meal_type,
      opted_in: parsed.data.opted_in === "true",
    },
    { onConflict: "tenant_id,date,meal_type" },
  );
  revalidatePath("/portal/food");
}
