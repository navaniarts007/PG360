"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { humanizeDbError } from "../errors";
import { logActivity } from "../activity";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { getSession } from "../auth";

export type RegisterState = { error?: string };

/* Self-serve signups start on a short, no-card trial — same `is_demo`
   mechanism platform.ts uses for super-admin-created demo accounts, just a
   fixed length instead of an admin-chosen one. */
const TRIAL_DAYS = 3;

function trialExpiry(): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + TRIAL_DAYS);
  return expiry.toISOString().slice(0, 10);
}

const pgDetailsSchema = z.object({
  pg_name: z.string().min(2, "PG name is required."),
  mobile: z.string().min(8, "Enter a valid mobile number."),
  location: z.string().min(2, "Location is required."),
  pg_type: z.enum(["boys", "girls", "coliving"]),
});

const registerSchema = pgDetailsSchema.extend({
  owner_name: z.string().min(2, "Your name is required."),
  owner_email: z.string().email("Enter a valid email."),
  owner_password: z.string().min(8, "Password must be at least 8 characters."),
  confirm_password: z.string(),
});

export async function registerOwnerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  if (d.owner_password !== d.confirm_password) {
    return { error: "The two passwords don't match." };
  }

  const admin = createAdminClient();

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: d.owner_email,
    password: d.owner_password,
    email_confirm: true,
    user_metadata: { full_name: d.owner_name },
  });
  if (userErr || !created.user) {
    const msg = humanizeDbError(userErr, "");
    return {
      error: /already|registered|exists/i.test(msg)
        ? "That email already has an account — sign in instead."
        : humanizeDbError(userErr, "Could not create your account."),
    };
  }

  const { data: pg, error: pgErr } = await admin
    .from("pg_accounts")
    .insert({
      owner_name: d.owner_name,
      pg_name: d.pg_name,
      mobile: d.mobile,
      location: d.location,
      pg_type: d.pg_type,
      category: "standard",
      subscription_plan: "monthly",
      subscription_expiry: trialExpiry(),
      is_demo: true,
      created_by: created.user.id,
      owner_id: created.user.id,
    })
    .select()
    .single();
  if (pgErr || !pg) {
    await admin.auth.admin.deleteUser(created.user.id); // roll back the orphan login
    return { error: humanizeDbError(pgErr, "Could not create your PG.") };
  }

  const { error: profErr } = await admin.from("profiles").upsert({
    id: created.user.id,
    role: "admin",
    pg_id: pg.id,
    full_name: d.owner_name,
    phone: d.mobile,
  });
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: humanizeDbError(profErr) };
  }

  await admin
    .from("property_members")
    .insert({ property_id: pg.id, user_id: created.user.id, role: "admin" });

  // Sign the new owner in immediately — they just set this password, no need
  // to make them retype it on the login page.
  const s = await createClient();
  const { error: signInErr } = await s.auth.signInWithPassword({
    email: d.owner_email,
    password: d.owner_password,
  });
  if (signInErr) return { error: "Account created — sign in to continue." };

  await logActivity("account.registered", `${d.owner_name} signed up PG "${d.pg_name}"`, {
    pgId: pg.id,
  });

  redirect("/dashboard");
}

/** Finishes a Google-initiated signup: the OAuth hop already created the
 *  Supabase auth user (see /auth/callback), this just fills in the PG the
 *  session had no way to ask Google for. */
export async function completeGoogleRegistrationAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = pgDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  const s = await createClient();
  const { data: userData, error: userErr } = await s.auth.getUser();
  if (userErr || !userData?.user) return { error: "Your session expired — start over from Register." };
  const user = userData.user;

  const admin = createAdminClient();

  // Defend against replaying this form after signup already completed.
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existingProfile) redirect("/dashboard");

  const ownerName = (user.user_metadata?.full_name as string | undefined) || user.email || "Owner";

  const { data: pg, error: pgErr } = await admin
    .from("pg_accounts")
    .insert({
      owner_name: ownerName,
      pg_name: d.pg_name,
      mobile: d.mobile,
      location: d.location,
      pg_type: d.pg_type,
      category: "standard",
      subscription_plan: "monthly",
      subscription_expiry: trialExpiry(),
      is_demo: true,
      created_by: user.id,
      owner_id: user.id,
    })
    .select()
    .single();
  if (pgErr || !pg) return { error: humanizeDbError(pgErr, "Could not create your PG.") };

  const { error: profErr } = await admin.from("profiles").upsert({
    id: user.id,
    role: "admin",
    pg_id: pg.id,
    full_name: ownerName,
    phone: d.mobile,
  });
  if (profErr) return { error: humanizeDbError(profErr) };

  await admin
    .from("property_members")
    .insert({ property_id: pg.id, user_id: user.id, role: "admin" });

  await logActivity("account.registered", `${ownerName} signed up PG "${d.pg_name}" via Google`, {
    pgId: pg.id,
  });

  redirect("/dashboard");
}

/** Guard for /register/finish-google: must have a session with no profile yet. */
export async function getGoogleRegistrationContext(): Promise<
  { ok: true; email: string; name: string } | { ok: false; redirectTo: string }
> {
  const s = await createClient();
  const { data, error } = await s.auth.getUser();
  if (error || !data?.user) return { ok: false, redirectTo: "/register" };

  const session = await getSession();
  if (session) return { ok: false, redirectTo: "/dashboard" };

  return {
    ok: true,
    email: data.user.email ?? "",
    name: (data.user.user_metadata?.full_name as string | undefined) || "",
  };
}
