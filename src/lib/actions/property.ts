"use server";

import { revalidatePath } from "next/cache";
import { humanizeDbError } from "../errors";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getActiveProperty, getSession, setActiveProperty } from "../auth";
import { requireRole } from "../guards";
import { query, queryOne, withTransaction } from "../mysql/client";
import type { PropertySettings } from "../types";

export type ActionState = { ok?: boolean; error?: string };

const MODULE_KEYS: (keyof PropertySettings)[] = [
  "food",
  "bookings",
  "complaints",
  "electricity",
  "daily_stay",
  "reviews",
  "visitors",
];

/** Save the active property's module toggles. */
export async function saveSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const settings: PropertySettings = {};
  for (const k of MODULE_KEYS) settings[k] = formData.get(k) === "on";
  try {
    await query(`update pg_accounts set settings = ? where id = ?`, [JSON.stringify(settings), pid]);
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

const moneySchema = z.object({
  owner_pan: z.string().optional(),
  property_address: z.string().optional(),
  food_included_default: z.coerce.boolean(),
  food_opt_out_deduction: z.coerce.number().int().min(0),
  notice_period_days: z.coerce.number().int().min(0).max(365),
  lock_in_months: z.coerce.number().int().min(0).max(36),
  deposit_months: z.coerce.number().int().min(0).max(12),
  electricity_included_units: z.coerce.number().int().min(0),
  electricity_per_unit_rate: z.coerce.number().int().min(0),
});

/** Save the property's money model: HRA/owner details, food default + opt-out
 *  deduction (on pg_accounts) and the notice/lock-in/deposit/electricity policy
 *  (upserted into pg_policies). */
export async function saveMoneySettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const raw = Object.fromEntries(formData);
  const parsed = moneySchema.safeParse({
    ...raw,
    food_included_default: formData.get("food_included_default") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  try {
    await query(
      `update pg_accounts set owner_pan = ?, property_address = ?, food_included_default = ?, food_opt_out_deduction = ? where id = ?`,
      [d.owner_pan?.trim() || null, d.property_address?.trim() || null, d.food_included_default, d.food_opt_out_deduction, pid],
    );
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }

  try {
    await query(
      `insert into pg_policies (pg_id, notice_period_days, lock_in_months, deposit_months, electricity_included_units, electricity_per_unit_rate)
       values (?, ?, ?, ?, ?, ?)
       on duplicate key update
         notice_period_days = values(notice_period_days),
         lock_in_months = values(lock_in_months),
         deposit_months = values(deposit_months),
         electricity_included_units = values(electricity_included_units),
         electricity_per_unit_rate = values(electricity_per_unit_rate)`,
      [pid, d.notice_period_days, d.lock_in_months, d.deposit_months, d.electricity_included_units, d.electricity_per_unit_rate],
    );
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/tenants", "layout");
  return { ok: true };
}

/** Switch the admin's active property (validated against their memberships). */
export async function setActivePropertyAction(propertyId: string): Promise<void> {
  const session = await getSession();
  if (!session) return;
  if (!session.properties.some((p) => p.id === propertyId)) return;
  await setActiveProperty(propertyId);
  revalidatePath("/dashboard", "layout");
}

const propertySchema = z.object({
  pg_name: z.string().min(2, "Property name is required."),
  location: z.string().min(2, "Location is required."),
  mobile: z.string().min(8, "Enter a valid mobile number."),
  pg_type: z.enum(["boys", "girls", "coliving"]),
  category: z.enum(["budget", "standard", "premium"]),
});

/** An owner adds another property to their portfolio. */
export async function createPropertyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["admin"]);
  const parsed = propertySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  // Billing is per-owner: a new property inherits this owner's plan/trial/expiry
  // from an existing property (so a trial owner's new property is also a trial).
  const existing = await queryOne<{
    is_demo: boolean;
    subscription_plan: string;
    subscription_expiry: string;
  }>(
    `select is_demo, subscription_plan, subscription_expiry from pg_accounts where owner_id = ? limit 1`,
    [me.id],
  );
  const fallbackExpiry = new Date();
  fallbackExpiry.setFullYear(fallbackExpiry.getFullYear() + 1);

  const newId = randomUUID();
  try {
    // Same transaction as the other onboarding actions in this branch (see
    // withTransaction's doc comment) — a property row committed without its
    // property_members row (e.g. a transient DB error on the second insert)
    // would otherwise leave an orphaned, unreachable property behind.
    await withTransaction(async (tx) => {
      await tx.query(
        `insert into pg_accounts
           (id, owner_name, pg_name, mobile, location, pg_type, category, subscription_plan,
            subscription_expiry, is_demo, created_by, owner_id)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          me.full_name,
          d.pg_name,
          d.mobile,
          d.location,
          d.pg_type,
          d.category,
          existing?.subscription_plan ?? "yearly",
          existing?.subscription_expiry ?? fallbackExpiry.toISOString().slice(0, 10),
          existing?.is_demo ?? false,
          me.id,
          me.id,
        ],
      );
      await tx.query(`insert into property_members (property_id, user_id, role) values (?, ?, 'admin')`, [
        newId,
        me.id,
      ]);
    });
  } catch (error) {
    return { error: humanizeDbError(error as never, "Could not create the property.") };
  }

  await setActiveProperty(newId);
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function updatePropertyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["admin"]);
  const id = String(formData.get("id"));
  if (!me.properties.some((p) => p.id === id)) return { error: "Not your property." };
  const parsed = propertySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  try {
    await query(
      `update pg_accounts set pg_name = ?, location = ?, mobile = ?, pg_type = ?, category = ? where id = ?`,
      [d.pg_name, d.location, d.mobile, d.pg_type, d.category, id],
    );
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/properties");
  return { ok: true };
}

export async function deletePropertyAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const id = String(formData.get("id"));
  if (!me.properties.some((p) => p.id === id)) return;
  if (me.properties.length <= 1) return; // never delete the last property
  const row = await queryOne<{ n: number }>(
    `select count(*) as n from tenants where pg_id = ? and status = 'active'`,
    [id],
  );
  if ((row?.n ?? 0) > 0) return; // block delete while active tenants exist
  await query(`delete from pg_accounts where id = ?`, [id]);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/properties");
}
