"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "../guards";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { notifyStaff } from "../notify";

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
  if (error) return { error: error.message };

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
  const { data: tenant } = await admin
    .from("tenants")
    .select("rent_amount")
    .eq("id", me.tenant_id)
    .maybeSingle();
  const { data: existing } = await admin
    .from("payments")
    .select("base_rent, electricity_charge, food_charge, other_charges, payment_screenshot_url")
    .eq("tenant_id", me.tenant_id)
    .eq("month_for", d.month_for)
    .maybeSingle();

  const { error } = await admin.from("payments").upsert(
    {
      pg_id: me.pg_id,
      tenant_id: me.tenant_id,
      month_for: d.month_for,
      base_rent: existing?.base_rent ?? tenant?.rent_amount ?? 0,
      electricity_charge: existing?.electricity_charge ?? 0,
      food_charge: existing?.food_charge ?? 0,
      other_charges: existing?.other_charges ?? 0,
      amount_paid: d.amount_paid,
      payment_mode: d.payment_mode,
      payment_screenshot_url: d.screenshot_url ?? existing?.payment_screenshot_url ?? null,
      payment_date: new Date().toISOString().slice(0, 10),
    },
    { onConflict: "tenant_id,month_for" },
  );
  if (error) return { error: error.message };

  await notifyStaff(
    me.pg_id,
    `${me.full_name} recorded a ${d.payment_mode.toUpperCase()} payment for ${d.month_for}`,
    "/dashboard/payments",
  );
  revalidatePath("/portal/bill");
  revalidatePath("/dashboard/payments");
  return { ok: true };
}
