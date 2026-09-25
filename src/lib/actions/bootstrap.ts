"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { queryOne, withTransaction } from "../mysql/client";
import { signIn, homeForRole } from "../auth";

export type BootstrapState = { error?: string };

const schema = z.object({
  full_name: z.string().min(2, "Enter your name."),
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirm: z.string(),
});

/** Whether the one-time setup page should render at all. A fresh database
 *  from the committed schema has no seed data and no way to sign in — the
 *  normal account-creation path (createPgAction) requires an existing
 *  super_admin, which doesn't exist yet either. This is the only door in:
 *  it self-closes forever the moment any user row exists. */
export async function needsBootstrap(): Promise<boolean> {
  const row = await queryOne<{ n: number }>(`select count(*) as n from users`);
  return (row?.n ?? 0) === 0;
}

/** Creates the first super_admin account, then signs them in. Guarded by a
 *  count(*) check inside the same transaction as the insert — not a perfect
 *  distributed lock against two literally-simultaneous submissions, but this
 *  is a one-time interactive setup step on a fresh install, not a hot path,
 *  so that trade-off is fine; the worst case is two super_admin rows, not an
 *  authorization gap. */
export async function bootstrapAction(
  _prev: BootstrapState,
  formData: FormData,
): Promise<BootstrapState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  if (d.password !== d.confirm) return { error: "The two passwords don't match." };

  const email = d.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(d.password, 10);
  const userId = randomUUID();

  let created: boolean;
  try {
    created = await withTransaction(async (tx) => {
      const existing = await tx.queryOne<{ n: number }>(`select count(*) as n from users`);
      if ((existing?.n ?? 0) > 0) return false;

      await tx.query(`insert into users (id, email, password_hash) values (?, ?, ?)`, [
        userId,
        email,
        passwordHash,
      ]);
      await tx.query(`insert into profiles (id, role, full_name) values (?, 'super_admin', ?)`, [
        userId,
        d.full_name,
      ]);
      return true;
    });
  } catch (err) {
    if (err instanceof Error && /duplicate/i.test(err.message)) {
      return { error: "That email is already in use." };
    }
    return { error: "Could not complete setup. Try again." };
  }

  if (!created) {
    return { error: "Setup has already been completed — sign in instead." };
  }

  const result = await signIn(email, d.password);
  if (!result.ok) {
    // Account was created fine; sign-in itself failing here would be very
    // unusual (e.g. a DB blip right after commit) — send them to the normal
    // login form rather than leaving them stuck on a dead-end error.
    redirect("/login");
  }
  redirect(homeForRole("super_admin"));
}
