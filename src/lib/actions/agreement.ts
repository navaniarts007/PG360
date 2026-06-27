"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { humanizeDbError } from "../errors";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { createAdminClient } from "../supabase/admin";

export type ActionState = { ok?: boolean; error?: string };

const cld = /^cld:/;

/* -------- admin: build the policy sections + owner signature -------------- */

const sectionSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2, "Section title is required."),
  body: z.string().optional(),
});

export async function saveSectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const parsed = sectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const admin = createAdminClient();

  if (d.id) {
    const { error } = await admin
      .from("agreement_sections")
      .update({ title: d.title, body: d.body ?? "" })
      .eq("id", d.id)
      .eq("pg_id", pid);
    if (error) return { error: humanizeDbError(error) };
  } else {
    const { data: last } = await admin
      .from("agreement_sections")
      .select("idx")
      .eq("pg_id", pid)
      .order("idx", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextIdx = ((last?.idx as number | undefined) ?? 0) + 1;
    const { error } = await admin
      .from("agreement_sections")
      .insert({ pg_id: pid, idx: nextIdx, title: d.title, body: d.body ?? "" });
    if (error) return { error: humanizeDbError(error) };
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function deleteSectionAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  const id = String(formData.get("id"));
  if (!pid || !id) return;
  const admin = createAdminClient();
  await admin.from("agreement_sections").delete().eq("id", id).eq("pg_id", pid);
  revalidatePath("/dashboard/settings");
}

export async function saveOwnerSignatureAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const url = String(formData.get("signature_url") ?? "");
  if (!cld.test(url)) return { error: "Please add a signature image first." };
  const admin = createAdminClient();
  const { error } = await admin.from("pg_accounts").update({ owner_signature_url: url }).eq("id", pid);
  if (error) return { error: humanizeDbError(error) };
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/* -------- tenant: accept + sign the agreement (first login) --------------- */

export async function acceptAgreementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["tenant"]);
  if (!me.tenant_id || !me.pg_id) return { error: "No tenant record found." };
  const url = String(formData.get("signature_url") ?? "");
  if (!cld.test(url)) return { error: "Please add your signature to continue." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("tenant_agreements")
    .upsert(
      { pg_id: me.pg_id, tenant_id: me.tenant_id, signature_url: url, accepted_at: new Date().toISOString() },
      { onConflict: "tenant_id" },
    );
  if (error) return { error: humanizeDbError(error, "Could not save your agreement.") };
  redirect("/portal");
}
