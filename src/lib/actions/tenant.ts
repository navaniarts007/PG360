"use server";

import { revalidatePath } from "next/cache";
import { humanizeDbError } from "../errors";
import { z } from "zod";
import { requireRole } from "../guards";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { notifyStaff } from "../notify";
import { computeBill } from "../money";

export type ActionState = { ok?: boolean; error?: string };

const issueSchema = z.object({
  category: z.enum(["electricity", "plumbing", "wifi", "cleaning", "noise", "other"]),
  description: z.string().min(5, "Please describe the issue (5+ characters)."),
});

export async function raiseIssueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["tenant"]);
  if (!me.tenant_id || !me.pg_id) {
    return { error: "No tenant record linked to your login." };
  }
  const parsed = issueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const s = await createClient();
  const { error } = await s.from("issues").insert({
    pg_id: me.pg_id,
    tenant_id: me.tenant_id,
    category: parsed.data.category,
    description: parsed.data.description,
  });
  if (error) return { error: humanizeDbError(error) };

  await notifyStaff(
    me.pg_id,
    `New ${parsed.data.category} complaint from ${me.full_name}`,
    "/dashboard/issues",
  );
  revalidatePath("/portal/issues");
  return { ok: true };
}

/* ------------------------------- self-record a payment ------------------------------- */

const paySchema = z.object({
  month_for: z.string().min(1),
  amount_paid: z.coerce.number().min(1, "Enter the amount you paid."),
  payment_mode: z.enum(["cash", "upi", "bank"]),
  screenshot_url: z.string().optional(),
});

/** A tenant records what they paid (UPI requires a screenshot). Uses the service
 *  client since RLS makes tenants read-only on payments; only ever touches their
 *  own current/derived invoice. Admin sees it with the proof and can adjust. */
export async function tenantRecordPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["tenant"]);
  if (!me.tenant_id || !me.pg_id) return { error: "No tenant record linked to your login." };
  const parsed = paySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  if (d.payment_mode === "upi" && !d.screenshot_url) {
    return { error: "Please upload your UPI payment screenshot." };
  }
  if (d.screenshot_url && !/^https:\/\/res\.cloudinary\.com\//.test(d.screenshot_url)) {
    return { error: "Invalid screenshot URL." };
  }

  const admin = createAdminClient();
  const [{ data: tenant }, { data: pg }] = await Promise.all([
    admin
      .from("tenants")
      .select("rent_amount, checkin_date, food_opt_out")
      .eq("id", me.tenant_id)
      .maybeSingle(),
    admin.from("pg_accounts").select("food_opt_out_deduction").eq("id", me.pg_id).maybeSingle(),
  ]);
  const { data: existing } = await admin
    .from("payments")
    .select("base_rent, electricity_charge, food_charge, other_charges, food_opt_out_deduction, is_pro_rata, pro_rata_days, payment_screenshot_url")
    .eq("tenant_id", me.tenant_id)
    .eq("month_for", d.month_for)
    .maybeSingle();

  // First-time invoice for this month → derive it the Bangalore way.
  const derived = computeBill({
    pricePerMonth: tenant?.rent_amount ?? 0,
    checkinISO: tenant?.checkin_date ?? d.month_for + "-01",
    month: d.month_for,
    foodOptOut: tenant?.food_opt_out ?? false,
    foodOptOutDeduction: pg?.food_opt_out_deduction ?? 0,
  });

  const { error } = await admin.from("payments").upsert(
    {
      pg_id: me.pg_id,
      tenant_id: me.tenant_id,
      month_for: d.month_for,
      base_rent: existing?.base_rent ?? derived.baseRent,
      electricity_charge: existing?.electricity_charge ?? 0,
      food_charge: existing?.food_charge ?? 0,
      other_charges: existing?.other_charges ?? 0,
      food_opt_out_deduction: existing?.food_opt_out_deduction ?? derived.foodDeduction,
      is_pro_rata: existing?.is_pro_rata ?? derived.isProRata,
      pro_rata_days: existing?.pro_rata_days ?? (derived.isProRata ? derived.proRataDays : null),
      amount_paid: d.amount_paid,
      payment_mode: d.payment_mode,
      payment_screenshot_url: d.screenshot_url ?? existing?.payment_screenshot_url ?? null,
      payment_date: new Date().toISOString().slice(0, 10),
      verified: false, // tenant-submitted — owner must confirm
    },
    { onConflict: "tenant_id,month_for" },
  );
  if (error) return { error: humanizeDbError(error) };

  await notifyStaff(
    me.pg_id,
    `${me.full_name} recorded a ${d.payment_mode.toUpperCase()} payment for ${d.month_for}`,
    "/dashboard/payments",
  );
  revalidatePath("/portal/bill");
  revalidatePath("/dashboard/payments");
  return { ok: true };
}

