"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { homeForRole, signIn, signOut, getSession } from "./auth";
import { query, queryOne, withTransaction } from "./mysql/client";
import { generateSessionToken, hashToken } from "./mysql/session-token";
import { sendEmail } from "./email";
import { isAllowedHost } from "./clients";

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
// Replaces Supabase Auth's resetPasswordForEmail/exchangeCodeForSession flow.
// Same shape as a session token: the raw token only ever exists in the
// emailed link; only its SHA-256 hash is stored (password_resets table).

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export type ResetState = { error?: string; sent?: boolean };
export type ChangePasswordState = { error?: string; done?: boolean };

const SAFE_DEFAULT_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://pg360.software";

/** The origin to build outbound links (password-reset emails) from. Never
 *  trusts the request's Origin/X-Forwarded-Host directly — those are
 *  client-supplied and a caller can set them to an arbitrary value on a
 *  direct HTTP request, which would otherwise put an attacker-controlled
 *  host into a legitimate user's reset email. Only a host this app is
 *  actually known to be served on is used; anything else falls back to the
 *  safe default. */
async function appOrigin(): Promise<string> {
  const hdrs = await headers();
  const forwardedHost = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  if (forwardedHost && isAllowedHost(forwardedHost)) {
    const protocol = forwardedHost.startsWith("localhost") ? "http" : "https";
    return `${protocol}://${forwardedHost}`;
  }
  return SAFE_DEFAULT_ORIGIN;
}

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

  const user = await queryOne<{ id: string }>(`select id from users where email = ?`, [email]);
  if (user) {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    await query(
      `insert into password_resets (user_id, token_hash, expires_at) values (?, ?, ?)`,
      [user.id, hashToken(token), expiresAt],
    );

    const origin = await appOrigin();
    const link = `${origin}/reset-password?token=${token}`;
    await sendEmail({
      to: email,
      subject: "Reset your PG360 password",
      html: `<p>Click the link below to set a new password. This link expires in 1 hour and can only be used once.</p><p><a href="${link}">${link}</a></p>`,
    });
  }

  return { sent: true };
}

/** Validates a reset token for the page to render — doesn't consume it.
 *  Returns the email to display, or null if invalid/expired/used. */
export async function validateResetToken(token: string): Promise<string | null> {
  if (!token) return null;
  const row = await queryOne<{ email: string }>(
    `select u.email
       from password_resets r
       join users u on u.id = r.user_id
      where r.token_hash = ? and r.used_at is null and r.expires_at > now()`,
    [hashToken(token)],
  );
  return row?.email ?? null;
}

/** Step 2: set a new password from the emailed token. Single-use.
 *
 *  Claims the token with an atomic UPDATE ... WHERE used_at IS NULL (checked
 *  via ROW_COUNT()) before doing anything else, inside a transaction with the
 *  password change — two concurrent submissions of the same token can no
 *  longer both pass a "is it used" read and both reset the account; only the
 *  one whose UPDATE actually flips used_at=NULL -> now() proceeds. */
export async function updatePasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const tokenHash = hashToken(token);
  const passwordHash = await bcrypt.hash(password, 10);

  const userId = await withTransaction(async (tx) => {
    await tx.query(
      `update password_resets set used_at = now()
        where token_hash = ? and used_at is null and expires_at > now()`,
      [tokenHash],
    );
    const claimed = await tx.queryOne<{ affected: number }>(`select row_count() as affected`);
    if (!claimed || claimed.affected !== 1) return null;

    const row = await tx.queryOne<{ user_id: string }>(
      `select user_id from password_resets where token_hash = ?`,
      [tokenHash],
    );
    if (!row) return null;

    await tx.query(`update users set password_hash = ?, failed_attempts = 0, locked_until = null where id = ?`, [
      passwordHash,
      row.user_id,
    ]);
    // Reset password invalidates any existing sessions for this user.
    await tx.query(`delete from sessions where user_id = ?`, [row.user_id]);
    return row.user_id;
  });

  if (!userId) return { error: "Your reset link has expired — request a new one." };

  redirect("/login?reset=1");
}

/** Change password while signed in — requires the current password. Unlike the
 *  email flow this keeps the current session, so the user isn't kicked out mid-task. */
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

  const session = await getSession();
  if (!session) return { error: "You're signed out — sign in and try again." };

  const row = await queryOne<{ password_hash: string }>(
    `select password_hash from users where id = ?`,
    [session.id],
  );
  if (!row) return { error: "You're signed out — sign in and try again." };

  const valid = await bcrypt.compare(current, row.password_hash);
  if (!valid) return { error: "Your current password is incorrect." };

  const passwordHash = await bcrypt.hash(password, 10);
  await query(`update users set password_hash = ? where id = ?`, [passwordHash, session.id]);

  return { done: true };
}
