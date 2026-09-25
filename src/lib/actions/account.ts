"use server";

import { redirect } from "next/navigation";
import { requireRole } from "../guards";
import { query } from "../mysql/client";
import { TERMS_VERSION } from "../site";

/** Records that the signed-in owner/staff accepted the current terms. */
export async function acceptTermsAction(): Promise<void> {
  const me = await requireRole(["admin", "staff"]);
  await query(`update profiles set terms_accepted_at = now(), terms_version = ? where id = ?`, [
    TERMS_VERSION,
    me.id,
  ]);
  redirect("/dashboard");
}
