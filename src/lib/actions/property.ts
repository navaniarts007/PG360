"use server";

import { revalidatePath } from "next/cache";
import { humanizeDbError } from "../errors";
import { z } from "zod";
import { getActiveProperty, getSession, setActiveProperty } from "../auth";
import { requireRole } from "../guards";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
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
  const admin = createAdminClient();
  const { error } = await admin.from("pg_accounts").update({ settings }).eq("id", pid);
  if (error) return { error: humanizeDbError(error) };
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
  const admin = createAdminClient();

  const { error: pgErr } = await admin
    .from("pg_accounts")
    .update({
      owner_pan: d.owner_pan?.trim() || null,
      property_address: d.property_address?.trim() || null,
      food_included_default: d.food_included_default,
      food_opt_out_deduction: d.food_opt_out_deduction,
    })
    .eq("id", pid);
  if (pgErr) return { error: humanizeDbError(pgErr) };

  const { error: polErr } = await admin
    .from("pg_policies")
    .upsert(
      {
        pg_id: pid,
        notice_period_days: d.notice_period_days,
        lock_in_months: d.lock_in_months,
        deposit_months: d.deposit_months,
        electricity_included_units: d.electricity_included_units,
        electricity_per_unit_rate: d.electricity_per_unit_rate,
      },
      { onConflict: "pg_id" },
    );
  if (polErr) return { error: humanizeDbError(polErr) };

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
  const admin = createAdminClient();

  // Billing is per-owner: a new property inherits this owner's plan/trial/expiry
  // from an existing property (so a trial owner's new property is also a trial).
  const { data: existing } = await admin
    .from("pg_accounts")
    .select("is_demo, subscription_plan, subscription_expiry")
    .eq("owner_id", me.id)
    .limit(1)
    .maybeSingle();
  const fallbackExpiry = new Date();
  fallbackExpiry.setFullYear(fallbackExpiry.getFullYear() + 1);
  const { data: pg, error } = await admin
    .from("pg_accounts")
    .insert({
      owner_name: me.full_name,
      pg_name: d.pg_name,
      mobile: d.mobile,
      location: d.location,
      pg_type: d.pg_type,
      category: d.category,
      subscription_plan: existing?.subscription_plan ?? "yearly",
      subscription_expiry: existing?.subscription_expiry ?? fallbackExpiry.toISOString().slice(0, 10),
      is_demo: existing?.is_demo ?? false,
      created_by: me.id,
      owner_id: me.id,
    })
    .select()
    .single();
  if (error || !pg) return { error: humanizeDbError(error, "Could not create the property.") };

  await admin
    .from("property_members")
    .insert({ property_id: pg.id, user_id: me.id, role: "admin" });

  await setActiveProperty(pg.id);
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
  const s = await createClient();
  const { error } = await s.from("pg_accounts").update(parsed.data).eq("id", id);
  if (error) return { error: humanizeDbError(error) };
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/properties");
  return { ok: true };
}

export async function deletePropertyAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin"]);
  const id = String(formData.get("id"));
  if (!me.properties.some((p) => p.id === id)) return;
  if (me.properties.length <= 1) return; // never delete the last property
  const admin = createAdminClient();
  const { count } = await admin
    .from("tenants")
    .select("id", { count: "exact", head: true })
    .eq("pg_id", id)
    .eq("status", "active");
  if ((count ?? 0) > 0) return; // block delete while active tenants exist
  await admin.from("pg_accounts").delete().eq("id", id);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/properties");
}
