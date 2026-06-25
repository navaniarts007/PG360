"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { humanizeDbError } from "../errors";
import { z } from "zod";
import { requireRole } from "../guards";
import { clearImpersonation, setImpersonation } from "../auth";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";

export type ActionState = { ok?: boolean; error?: string };

const pgSchema = z.object({
  pg_name: z.string().min(2, "PG name is required."),
  owner_name: z.string().min(2, "Owner name is required."),
  mobile: z.string().min(8, "Enter a valid mobile number."),
  location: z.string().min(2, "Location is required."),
  pg_type: z.enum(["boys", "girls", "coliving"]),
  category: z.enum(["budget", "standard", "premium"]),
  subscription_plan: z.enum(["starter", "pro", "lifetime"]),
  owner_email: z.string().email("Enter a valid owner email."),
  owner_password: z.string().min(6, "Password must be at least 6 characters."),
  edition: z.enum(["full", "gvm"]).default("full"),
  reg_prefix: z.string().max(12).optional(),
});

export async function createPgAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["super_admin"]);
  const parsed = pgSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  const admin = createAdminClient();

  // 1) the owner's auth login
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: d.owner_email,
    password: d.owner_password,
    email_confirm: true,
    user_metadata: { full_name: d.owner_name },
  });
  if (userErr || !created.user) {
    return {
      error: /already|registered|exists/i.test(humanizeDbError(userErr, ""))
        ? "That owner email already has an account."
        : humanizeDbError(userErr, "Could not create the owner login."),
    };
  }

  // 2) the PG account
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  const { data: pg, error: pgErr } = await admin
    .from("pg_accounts")
    .insert({
      owner_name: d.owner_name,
      pg_name: d.pg_name,
      mobile: d.mobile,
      location: d.location,
      pg_type: d.pg_type,
      category: d.category,
      subscription_plan: d.subscription_plan,
      subscription_expiry: expiry.toISOString().slice(0, 10),
      created_by: me.id,
      owner_id: created.user.id,
      edition: d.edition,
      portal_enabled: d.edition !== "gvm",
      reg_prefix: d.reg_prefix?.trim() ? d.reg_prefix.trim().toUpperCase() : null,
    })
    .select()
    .single();
  if (pgErr || !pg) {
    await admin.auth.admin.deleteUser(created.user.id); // roll back the orphan login
    return { error: humanizeDbError(pgErr, "Could not create the PG.") };
  }

  // 3) the owner's profile (role=admin) + property membership
  const { error: profErr } = await admin.from("profiles").upsert({
    id: created.user.id,
    role: "admin",
    pg_id: pg.id,
    full_name: d.owner_name,
    phone: d.mobile,
  });
  if (profErr) return { error: humanizeDbError(profErr) };

  await admin
    .from("property_members")
    .insert({ property_id: pg.id, user_id: created.user.id, role: "admin" });

  revalidatePath("/platform");
  revalidatePath("/platform/accounts");
  return { ok: true };
}

const editSchema = z.object({
  id: z.string().uuid(),
  owner_name: z.string().min(2, "Owner name is required."),
  mobile: z.string().min(8, "Enter a valid mobile number."),
  location: z.string().min(2, "Location is required."),
  subscription_plan: z.enum(["starter", "pro", "lifetime"]),
  edition: z.enum(["full", "gvm"]),
  reg_prefix: z.string().max(12).optional(),
});

/** Edit a PG account's details + edition/access (super-admin only). */
export async function updateAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["super_admin"]);
  const raw = Object.fromEntries(formData);
  const parsed = editSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  const portalEnabled = formData.get("portal_enabled") === "on";
  const prefix = d.reg_prefix?.trim() ? d.reg_prefix.trim().toUpperCase() : null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("pg_accounts")
    .update({
      owner_name: d.owner_name,
      mobile: d.mobile,
      location: d.location,
      subscription_plan: d.subscription_plan,
      edition: d.edition,
      portal_enabled: portalEnabled,
      reg_prefix: prefix,
    })
    .eq("id", d.id);
  if (error) return { error: humanizeDbError(error, "Could not update the account.") };

  revalidatePath("/platform");
  revalidatePath("/platform/accounts");
  revalidatePath(`/platform/accounts/${d.id}`);
  return { ok: true };
}

/** Permanently delete a PG account and all its data (super-admin only).
 *  Child tables cascade on pg_account delete; we also remove the owner +
 *  tenant auth logins so no orphan accounts are left behind. */
export async function deleteAccountAction(formData: FormData): Promise<void> {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id"));
  if (!id) return;
  const admin = createAdminClient();

  // collect auth logins to clean up before the cascade removes their rows
  const { data: pg } = await admin
    .from("pg_accounts")
    .select("owner_id")
    .eq("id", id)
    .maybeSingle();
  const { data: tenantRows } = await admin
    .from("tenants")
    .select("user_id")
    .eq("pg_id", id);

  const { error } = await admin.from("pg_accounts").delete().eq("id", id);
  if (error) return; // FK/RLS guard — surfaced as a no-op; account stays put

  const userIds = new Set<string>();
  if (pg?.owner_id) userIds.add(pg.owner_id);
  for (const t of (tenantRows ?? []) as { user_id: string | null }[]) {
    if (t.user_id) userIds.add(t.user_id);
  }
  for (const uid of userIds) {
    await admin.auth.admin.deleteUser(uid).catch(() => {});
  }

  revalidatePath("/platform");
  revalidatePath("/platform/accounts");
}

/** Super-admin "open / view as": enter a PG and manage it as its owner. */
export async function startImpersonationAction(formData: FormData): Promise<void> {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id"));
  if (!id) return;
  await setImpersonation(id);
  redirect("/dashboard");
}

/** Exit impersonation and return to the platform panel. */
export async function stopImpersonationAction(): Promise<void> {
  await clearImpersonation();
  redirect("/platform/accounts");
}

/** Reset a PG owner's login password (super-admin only). */
export async function resetOwnerPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["super_admin"]);
  const ownerId = String(formData.get("owner_id"));
  const password = String(formData.get("new_password") ?? "");
  if (!ownerId) return { error: "This account has no owner login linked." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(ownerId, { password });
  if (error) return { error: humanizeDbError(error, "Could not reset the password.") };
  return { ok: true };
}

/* ----------------------------------------------------- billing invoices --- */

const invoiceSchema = z.object({
  pg_id: z.string().uuid(),
  description: z.string().min(2, "Description is required."),
  amount: z.coerce.number().min(0, "Enter an amount."),
  tax_percent: z.coerce.number().min(0).max(100).default(0),
  period_label: z.string().optional(),
  due_date: z.string().optional(),
  notes: z.string().optional(),
});

export async function createInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["super_admin"]);
  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("platform_invoices").insert({
    pg_id: d.pg_id,
    description: d.description,
    amount: d.amount,
    tax_percent: d.tax_percent,
    period_label: d.period_label?.trim() || null,
    due_date: d.due_date?.trim() || null,
    notes: d.notes?.trim() || null,
    created_by: me.id,
  });
  if (error) return { error: humanizeDbError(error, "Could not create the invoice.") };
  revalidatePath(`/platform/accounts/${d.pg_id}`);
  return { ok: true };
}

export async function toggleInvoicePaidAction(formData: FormData): Promise<void> {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id"));
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("platform_invoices")
    .select("status, pg_id")
    .eq("id", id)
    .maybeSingle();
  if (!inv) return;
  await admin
    .from("platform_invoices")
    .update({ status: inv.status === "paid" ? "unpaid" : "paid" })
    .eq("id", id);
  revalidatePath(`/platform/accounts/${inv.pg_id}`);
  revalidatePath(`/invoice/${id}`);
}

export async function deleteInvoiceAction(formData: FormData): Promise<void> {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id"));
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("platform_invoices")
    .select("pg_id")
    .eq("id", id)
    .maybeSingle();
  await admin.from("platform_invoices").delete().eq("id", id);
  if (inv) revalidatePath(`/platform/accounts/${inv.pg_id}`);
}

export async function togglePgStatusAction(formData: FormData): Promise<void> {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id"));
  const s = await createClient();
  const { data: pg } = await s.from("pg_accounts").select("status").eq("id", id).maybeSingle();
  if (!pg) return;
  await s
    .from("pg_accounts")
    .update({ status: pg.status === "active" ? "suspended" : "active" })
    .eq("id", id);
  revalidatePath("/platform");
  revalidatePath("/platform/accounts");
}
