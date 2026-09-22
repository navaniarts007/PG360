"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { humanizeDbError } from "../errors";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole } from "../guards";
import { clearImpersonation, setImpersonation } from "../auth";
import { logActivity } from "../activity";
import { query, queryOne, withTransaction } from "../mysql/client";

export type ActionState = { ok?: boolean; error?: string };

function expiryForPlan(plan: "monthly" | "yearly" | "lifetime"): string {
  const expiry = new Date();
  if (plan === "monthly") expiry.setMonth(expiry.getMonth() + 1);
  else if (plan === "yearly") expiry.setFullYear(expiry.getFullYear() + 1);
  else expiry.setFullYear(expiry.getFullYear() + 100);
  return expiry.toISOString().slice(0, 10);
}

const pgSchema = z.object({
  pg_name: z.string().min(2, "PG name is required."),
  owner_name: z.string().min(2, "Owner name is required."),
  mobile: z.string().min(8, "Enter a valid mobile number."),
  location: z.string().min(2, "Location is required."),
  pg_type: z.enum(["boys", "girls", "coliving"]),
  category: z.enum(["budget", "standard", "premium"]),
  subscription_plan: z.enum(["monthly", "yearly", "lifetime"]),
  owner_email: z.string().email("Enter a valid owner email."),
  owner_password: z.string().min(8, "Password must be at least 8 characters."),
  edition: z.enum(["full", "gvm"]).default("full"),
  reg_prefix: z.string().max(12).optional(),
});

/** Super-admin onboards a new PG: owner login + pg_account + profile +
 *  property membership, atomically (see withTransaction's doc comment). */
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

  const email = d.owner_email.trim().toLowerCase();
  const existingUser = await queryOne<{ id: string }>(`select id from users where email = ?`, [email]);
  if (existingUser) return { error: "That owner email already has an account." };

  const isDemo = formData.get("is_demo") === "on";
  const trialDays = Math.min(365, Math.max(1, Number(formData.get("trial_days")) || 3));
  const expiry = new Date();
  if (isDemo) expiry.setDate(expiry.getDate() + trialDays);
  else if (d.subscription_plan === "monthly") expiry.setMonth(expiry.getMonth() + 1);
  else if (d.subscription_plan === "yearly") expiry.setFullYear(expiry.getFullYear() + 1);
  else expiry.setFullYear(expiry.getFullYear() + 100);

  const passwordHash = await bcrypt.hash(d.owner_password, 10);
  const ownerId = randomUUID();
  const pgId = randomUUID();

  try {
    await withTransaction(async (tx) => {
      await tx.query(`insert into users (id, email, password_hash) values (?, ?, ?)`, [
        ownerId,
        email,
        passwordHash,
      ]);
      await tx.query(
        `insert into pg_accounts
           (id, owner_name, pg_name, mobile, location, pg_type, category, subscription_plan,
            subscription_expiry, is_demo, created_by, owner_id, edition, portal_enabled, reg_prefix)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pgId,
          d.owner_name,
          d.pg_name,
          d.mobile,
          d.location,
          d.pg_type,
          d.category,
          d.subscription_plan,
          expiry.toISOString().slice(0, 10),
          isDemo,
          me.id,
          ownerId,
          d.edition,
          d.edition !== "gvm",
          d.reg_prefix?.trim() ? d.reg_prefix.trim().toUpperCase() : null,
        ],
      );
      await tx.query(`insert into profiles (id, role, pg_id, full_name, phone) values (?, 'admin', ?, ?, ?)`, [
        ownerId,
        pgId,
        d.owner_name,
        d.mobile,
      ]);
      await tx.query(`insert into property_members (property_id, user_id, role) values (?, ?, 'admin')`, [
        pgId,
        ownerId,
      ]);
    });
  } catch (error) {
    return { error: humanizeDbError(error as never, "Could not create the PG.") };
  }

  await logActivity("account.created", `Created PG "${d.pg_name}" (${d.owner_name})`, { pgId });
  revalidatePath("/platform");
  revalidatePath("/platform/accounts");
  return { ok: true };
}

const editSchema = z.object({
  id: z.string().uuid(),
  owner_name: z.string().min(2, "Owner name is required."),
  mobile: z.string().min(8, "Enter a valid mobile number."),
  location: z.string().min(2, "Location is required."),
  subscription_plan: z.enum(["monthly", "yearly", "lifetime"]),
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
  const isDemo = formData.get("is_demo") === "on";
  const prefix = d.reg_prefix?.trim() ? d.reg_prefix.trim().toUpperCase() : null;

  const current = await queryOne<{ subscription_plan: string }>(
    `select subscription_plan from pg_accounts where id = ?`,
    [d.id],
  );
  let subscriptionExpiry: string | null = null;
  const trialDays = Number(formData.get("trial_days")) || 0;
  if (trialDays > 0) {
    const exp = new Date();
    exp.setDate(exp.getDate() + Math.min(365, trialDays));
    subscriptionExpiry = exp.toISOString().slice(0, 10);
  } else if (current?.subscription_plan !== d.subscription_plan) {
    subscriptionExpiry = expiryForPlan(d.subscription_plan);
  }

  try {
    if (subscriptionExpiry) {
      await query(
        `update pg_accounts set owner_name = ?, mobile = ?, location = ?, subscription_plan = ?,
                edition = ?, portal_enabled = ?, reg_prefix = ?, is_demo = ?, subscription_expiry = ?
          where id = ?`,
        [d.owner_name, d.mobile, d.location, d.subscription_plan, d.edition, portalEnabled, prefix, isDemo, subscriptionExpiry, d.id],
      );
    } else {
      await query(
        `update pg_accounts set owner_name = ?, mobile = ?, location = ?, subscription_plan = ?,
                edition = ?, portal_enabled = ?, reg_prefix = ?, is_demo = ?
          where id = ?`,
        [d.owner_name, d.mobile, d.location, d.subscription_plan, d.edition, portalEnabled, prefix, isDemo, d.id],
      );
    }
  } catch (error) {
    return { error: humanizeDbError(error as never, "Could not update the account.") };
  }

  // Billing is per-OWNER, not per-property: one login can run several properties,
  // so the trial/plan/expiry must apply to all of that owner's properties at once.
  const acct = await queryOne<{ owner_id: string | null }>(
    `select owner_id from pg_accounts where id = ?`,
    [d.id],
  );
  if (acct?.owner_id) {
    if (subscriptionExpiry) {
      await query(
        `update pg_accounts set is_demo = ?, subscription_plan = ?, subscription_expiry = ? where owner_id = ?`,
        [isDemo, d.subscription_plan, subscriptionExpiry, acct.owner_id],
      );
    } else {
      await query(`update pg_accounts set is_demo = ?, subscription_plan = ? where owner_id = ?`, [
        isDemo,
        d.subscription_plan,
        acct.owner_id,
      ]);
    }
  }

  await logActivity("account.updated", `Updated account settings`, { pgId: d.id });
  revalidatePath("/platform");
  revalidatePath("/platform/accounts");
  revalidatePath(`/platform/accounts/${d.id}`);
  return { ok: true };
}

/** Permanently delete a PG account and all its data (super-admin only).
 *  Child tables cascade on pg_account delete (FK ON DELETE CASCADE); we also
 *  remove the owner + tenant logins from `users` so no orphan accounts are
 *  left behind — those aren't part of the cascade since users isn't a child
 *  of pg_accounts. */
export async function deleteAccountAction(formData: FormData): Promise<void> {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id"));
  if (!id) return;

  const pg = await queryOne<{ owner_id: string | null; pg_name: string }>(
    `select owner_id, pg_name from pg_accounts where id = ?`,
    [id],
  );
  const tenantRows = await query<{ user_id: string | null }>(
    `select user_id from tenants where pg_id = ?`,
    [id],
  );

  try {
    await query(`delete from pg_accounts where id = ?`, [id]);
  } catch {
    return; // FK guard — surfaced as a no-op; account stays put
  }

  const userIds = new Set<string>();
  if (pg?.owner_id) userIds.add(pg.owner_id);
  for (const t of tenantRows) if (t.user_id) userIds.add(t.user_id);
  for (const uid of userIds) {
    await query(`delete from users where id = ?`, [uid]).catch(() => {});
  }

  await logActivity("account.deleted", `Deleted PG "${pg?.pg_name ?? ""}" and all its data`, {
    pgId: null,
  });
  revalidatePath("/platform");
  revalidatePath("/platform/accounts");
}

/** Super-admin "open / view as": enter a PG and manage it as its owner. */
export async function startImpersonationAction(formData: FormData): Promise<void> {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id"));
  if (!id) return;
  await logActivity("impersonation.start", "Opened a PG dashboard (view as owner)", { pgId: id });
  await setImpersonation(id);
  redirect("/dashboard");
}

/** Exit impersonation and return to the platform panel. */
export async function stopImpersonationAction(): Promise<void> {
  await clearImpersonation();
  redirect("/platform/accounts");
}

/** Reset a PG owner's login password (super-admin only). Also invalidates
 *  their existing sessions — a password reset should force re-login, same
 *  as the tenant-facing password reset flow does. */
export async function resetOwnerPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["super_admin"]);
  const ownerId = String(formData.get("owner_id"));
  const password = String(formData.get("new_password") ?? "");
  if (!ownerId) return { error: "This account has no owner login linked." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await query(`update users set password_hash = ?, failed_attempts = 0, locked_until = null where id = ?`, [
      passwordHash,
      ownerId,
    ]);
    await query(`delete from sessions where user_id = ?`, [ownerId]);
  } catch (error) {
    return { error: humanizeDbError(error as never, "Could not reset the password.") };
  }
  await logActivity("account.password_reset", "Reset an owner's login password", { pgId: null });
  return { ok: true };
}

/* ----------------------------------------------------- billing invoices --- */

const invoiceSchema = z.object({
  pg_id: z.string().uuid(),
  description: z.string().min(2, "Description is required."),
  amount: z.coerce.number().min(0, "Enter an amount."),
  tax_percent: z.coerce.number().min(0).max(100).default(0),
  billing_cycle: z.enum(["one_time", "monthly", "yearly"]).default("one_time"),
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
  try {
    const nextNo = await withTransaction(async (tx) => {
      await tx.query(`update platform_invoice_seq set next_no = last_insert_id(next_no + 1) where id = 1`);
      const row = await tx.queryOne<{ n: number }>(`select last_insert_id() as n`);
      return row?.n ?? 1001;
    });
    await query(
      `insert into platform_invoices
         (pg_id, number, description, amount, tax_percent, billing_cycle, period_label, due_date, notes, created_by)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.pg_id,
        nextNo,
        d.description,
        d.amount,
        d.tax_percent,
        d.billing_cycle,
        d.period_label?.trim() || null,
        d.due_date?.trim() || null,
        d.notes?.trim() || null,
        me.id,
      ],
    );
  } catch (error) {
    return { error: humanizeDbError(error as never, "Could not create the invoice.") };
  }
  await logActivity("invoice.created", `Created an invoice (₹${d.amount.toLocaleString("en-IN")})`, {
    pgId: d.pg_id,
  });
  revalidatePath(`/platform/accounts/${d.pg_id}`);
  return { ok: true };
}

export async function toggleInvoicePaidAction(formData: FormData): Promise<void> {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id"));
  const inv = await queryOne<{ status: string; pg_id: string }>(
    `select status, pg_id from platform_invoices where id = ?`,
    [id],
  );
  if (!inv) return;
  await query(`update platform_invoices set status = ? where id = ?`, [
    inv.status === "paid" ? "unpaid" : "paid",
    id,
  ]);
  revalidatePath(`/platform/accounts/${inv.pg_id}`);
  revalidatePath(`/invoice/${id}`);
}

export async function deleteInvoiceAction(formData: FormData): Promise<void> {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id"));
  const inv = await queryOne<{ pg_id: string }>(`select pg_id from platform_invoices where id = ?`, [id]);
  await query(`delete from platform_invoices where id = ?`, [id]);
  if (inv) revalidatePath(`/platform/accounts/${inv.pg_id}`);
}

export async function togglePgStatusAction(formData: FormData): Promise<void> {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id"));
  const pg = await queryOne<{ status: string }>(`select status from pg_accounts where id = ?`, [id]);
  if (!pg) return;
  await query(`update pg_accounts set status = ? where id = ?`, [
    pg.status === "active" ? "suspended" : "active",
    id,
  ]);
  revalidatePath("/platform");
  revalidatePath("/platform/accounts");
}
