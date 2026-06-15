"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "../guards";
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
      error: /already|registered|exists/i.test(userErr?.message ?? "")
        ? "That owner email already has an account."
        : userErr?.message ?? "Could not create the owner login.",
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
    })
    .select()
    .single();
  if (pgErr || !pg) {
    await admin.auth.admin.deleteUser(created.user.id); // roll back the orphan login
    return { error: pgErr?.message ?? "Could not create the PG." };
  }

  // 3) the owner's profile (role=admin, scoped to the new PG)
  const { error: profErr } = await admin.from("profiles").upsert({
    id: created.user.id,
    role: "admin",
    pg_id: pg.id,
    full_name: d.owner_name,
    phone: d.mobile,
  });
  if (profErr) return { error: profErr.message };

  revalidatePath("/platform");
  revalidatePath("/platform/accounts");
  return { ok: true };
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
