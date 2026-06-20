"use server";

import { revalidatePath } from "next/cache";
import { humanizeDbError } from "../errors";
import { z } from "zod";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";

export type ActionState = { ok?: boolean; error?: string };

const staffSchema = z.object({
  name: z.string().min(2, "Name is required."),
  phone: z.string().min(8, "Enter a valid phone."),
  email: z.string().email("Enter a valid email."),
  login_password: z.string().min(6, "Password must be 6+ characters."),
});

/** Owner adds a staff member to the active property. Creates an auth login,
 *  a profile (role 'staff'), and a property_members row. */
export async function createStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const admin = createAdminClient();

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.login_password,
    email_confirm: true,
    user_metadata: { full_name: d.name },
  });
  if (userErr || !created.user) {
    return {
      error: /already|registered|exists/i.test(humanizeDbError(userErr, ""))
        ? "That email already has a login."
        : humanizeDbError(userErr, "Could not create the staff login."),
    };
  }

  const { error: pErr } = await admin.from("profiles").upsert({
    id: created.user.id,
    role: "staff",
    pg_id: pid,
    full_name: d.name,
    phone: d.phone,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: humanizeDbError(pErr) };
  }

  const { error: mErr } = await admin.from("property_members").insert({
    property_id: pid,
    user_id: created.user.id,
    role: "staff",
  });
  if (mErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: humanizeDbError(mErr) };
  }

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

/** Remove a staff member from the active property. Owners (role 'admin') can't
 *  be removed this way. */
export async function deleteStaffAction(formData: FormData): Promise<void> {
  await requireRole(["admin"]);
  const pid = await getActiveProperty();
  if (!pid) return;
  const userId = String(formData.get("id"));
  const s = await createClient();

  const { data: profile } = await s
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || profile.role !== "staff") return; // never delete owners/admins

  const admin = createAdminClient();
  await admin.from("property_members").delete().eq("property_id", pid).eq("user_id", userId);
  // if they belong to no other property, remove the login + profile
  const { count } = await admin
    .from("property_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) === 0) {
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
  revalidatePath("/dashboard/staff");
}
