"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "../guards";
import { createClient } from "../supabase/server";
import { notifyStaff } from "../notify";

export type ActionState = { ok?: boolean; error?: string };

const issueSchema = z.object({
  category: z.enum(["electricity", "plumbing", "wifi", "cleaning", "noise", "other"]),
  description: z.string().min(5, "Please describe the issue (5+ characters)."),
});

export async function raiseIssueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["tenant"]);
  if (!me.tenant_id || !me.pg_id) {
    return { error: "No tenant record linked to your login." };
  }
  const parsed = issueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const s = await createClient();
  const { error } = await s.from("issues").insert({
    pg_id: me.pg_id,
    tenant_id: me.tenant_id,
    category: parsed.data.category,
    description: parsed.data.description,
  });
  if (error) return { error: error.message };

  await notifyStaff(
    me.pg_id,
    `New ${parsed.data.category} complaint from ${me.full_name}`,
    "/dashboard/issues",
  );
  revalidatePath("/portal/issues");
  return { ok: true };
}
