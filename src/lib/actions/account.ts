"use server";

import { redirect } from "next/navigation";
import { requireRole } from "../guards";
import { createAdminClient } from "../supabase/admin";
import { TERMS_VERSION } from "../site";

/** Records that the signed-in owner/staff accepted the current terms. */
export async function acceptTermsAction(): Promise<void> {
  const me = await requireRole(["admin", "staff"]);
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
    })
    .eq("id", me.id);
  redirect("/dashboard");
}
