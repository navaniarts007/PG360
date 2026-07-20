"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { homeForRole, signIn, signOut } from "./auth";
import { createClient } from "./supabase/server";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error };

  redirect(homeForRole(result.user.role));
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}

/* --------------------------- password reset ---------------------------- */

export type ResetState = { error?: string; sent?: boolean };
export type ChangePasswordState = { error?: string; done?: boolean };

/** Step 1: email a password-reset link. Always reports success so we never
 *  reveal whether an email is registered. */
export async function requestPasswordResetAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Enter a valid email." };
  }
  const supabase = await createClient();
  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ||
    (hdrs.get("x-forwarded-host") ? `https://${hdrs.get("x-forwarded-host")}` : null) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://pg360.software";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  return { sent: true };
}

/** Step 2: set a new password (requires the recovery session from the link). */
export async function updatePasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired — request a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  await signOut();
  redirect("/login?reset=1");
}

/** Change password while signed in — requires the current password. Unlike the
 *  email flow this keeps the session, so the user isn't kicked out mid-task. */
export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current) return { error: "Enter your current password." };
  if (password.length < 8) return { error: "New password must be at least 8 characters." };
  if (password !== confirm) return { error: "The two new passwords don't match." };
  if (password === current) {
    return { error: "The new password must be different from the current one." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "You're signed out — sign in and try again." };

  // Re-authenticate so a walk-up attacker on an open session can't take it over.
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (authError) return { error: "Your current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { done: true };
}
