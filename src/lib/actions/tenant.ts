"use server";

import { revalidatePath } from "next/cache";
import { humanizeDbError } from "../errors";
import { z } from "zod";
import { requireRole } from "../guards";
import { query, queryOne } from "../mysql/client";
import { notifyStaff } from "../notify";
import { computeBill } from "../money";
import { logTenantEvent } from "../events";

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

  try {
    await query(`insert into issues (pg_id, tenant_id, category, description) values (?, ?, ?, ?)`, [
      me.pg_id,
      me.tenant_id,
      parsed.data.category,
      parsed.data.description,
    ]);
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }

  await notifyStaff(
    me.pg_id,
    `New ${parsed.data.category} complaint from ${me.full_name}`,
    "/dashboard/issues",
  );
  await logTenantEvent({
    pgId: me.pg_id,
    tenantId: me.tenant_id,
    type: "complaint",
    detail: `${parsed.data.category}: ${parsed.data.description.slice(0, 80)}`,
  });
  revalidatePath("/portal/issues");
  return { ok: true };
}

/* ------------------------------- self-record a payment ------------------------------- */

const paySchema = z.object({
  month_for: z.string().min(1),
  amount_paid: z.coerce.number().min(1, "Enter the amount you paid."),
  payment_mode: z.enum(["cash", "upi", "bank"]),
  payment_date: z.string().optional(),
  screenshot_url: z.string().optional(),
});

/** A tenant records what they paid (UPI requires a screenshot). Scoped to
 *  their own tenant_id (passed explicitly, not RLS-inferred) — only ever
 *  touches their own current/derived invoice. Admin sees it with the proof
 *  and can adjust. */
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

  const [tenant, pg, existing] = await Promise.all([
    queryOne<{ rent_amount: number; checkin_date: string; food_opt_out: boolean }>(
      `select rent_amount, checkin_date, food_opt_out from tenants where id = ? and pg_id = ?`,
      [me.tenant_id, me.pg_id],
    ),
    queryOne<{ food_opt_out_deduction: number }>(
      `select food_opt_out_deduction from pg_accounts where id = ?`,
      [me.pg_id],
    ),
    queryOne<{
      base_rent: number;
      electricity_charge: number;
      food_charge: number;
      other_charges: number;
      food_opt_out_deduction: number;
      is_pro_rata: boolean;
      pro_rata_days: number | null;
      payment_screenshot_url: string | null;
    }>(
      `select base_rent, electricity_charge, food_charge, other_charges, food_opt_out_deduction,
              is_pro_rata, pro_rata_days, payment_screenshot_url
         from payments where tenant_id = ? and month_for = ?`,
      [me.tenant_id, d.month_for],
    ),
  ]);

  // First-time invoice for this month -> derive it the Bangalore way.
  const derived = computeBill({
    pricePerMonth: tenant?.rent_amount ?? 0,
    checkinISO: tenant?.checkin_date ?? d.month_for + "-01",
    month: d.month_for,
    foodOptOut: tenant?.food_opt_out ?? false,
    foodOptOutDeduction: pg?.food_opt_out_deduction ?? 0,
  });

  try {
    await query(
      `insert into payments
         (pg_id, tenant_id, month_for, base_rent, electricity_charge, food_charge, other_charges,
          food_opt_out_deduction, is_pro_rata, pro_rata_days, amount_paid, payment_mode,
          payment_screenshot_url, payment_date, verified)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false)
       on duplicate key update
         amount_paid = values(amount_paid),
         payment_mode = values(payment_mode),
         payment_screenshot_url = values(payment_screenshot_url),
         payment_date = values(payment_date),
         verified = false`,
      [
        me.pg_id,
        me.tenant_id,
        d.month_for,
        existing?.base_rent ?? derived.baseRent,
        existing?.electricity_charge ?? 0,
        existing?.food_charge ?? 0,
        existing?.other_charges ?? 0,
        existing?.food_opt_out_deduction ?? derived.foodDeduction,
        existing?.is_pro_rata ?? derived.isProRata,
        existing?.pro_rata_days ?? (derived.isProRata ? derived.proRataDays : null),
        d.amount_paid,
        d.payment_mode,
        d.screenshot_url ?? existing?.payment_screenshot_url ?? null,
        d.payment_date || new Date().toISOString().slice(0, 10),
      ],
    );
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }

  await notifyStaff(
    me.pg_id,
    `${me.full_name} recorded a ${d.payment_mode.toUpperCase()} payment for ${d.month_for}`,
    "/dashboard/payments",
  );
  revalidatePath("/portal/bill");
  revalidatePath("/dashboard/payments");
  return { ok: true };
}

/* ------------------------------- profile photo ------------------------------- */

/** Tenant sets their portal profile photo (Cloudinary URL). Scoped to their
 *  own tenant_id. */
export async function tenantUpdateAvatarAction(
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const me = await requireRole(["tenant"]);
  if (!me.tenant_id) return { error: "No tenant record linked to your login." };
  const url = String(formData.get("avatar_url") || "");
  if (url && !/^https:\/\/res\.cloudinary\.com\//.test(url)) {
    return { error: "Invalid image URL." };
  }
  try {
    await query(`update tenants set avatar_url = ? where id = ?`, [url || null, me.tenant_id]);
  } catch (error) {
    return { error: (error as { message?: string })?.message ?? "Could not save." };
  }
  revalidatePath("/portal");
  return { ok: true };
}
