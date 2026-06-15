"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { homeForRole, signIn, signOut } from "./auth";

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
