"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { humanizeDbError } from "../errors";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { query, queryOne } from "../mysql/client";

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

  try {
    if (d.id) {
      await query(`update agreement_sections set title = ?, body = ? where id = ? and pg_id = ?`, [
        d.title,
        d.body ?? "",
        d.id,
        pid,
      ]);
    } else {
      const last = await queryOne<{ idx: number }>(
        `select idx from agreement_sections where pg_id = ? order by idx desc limit 1`,
        [pid],
      );
      const nextIdx = (last?.idx ?? 0) + 1;
      await query(`insert into agreement_sections (pg_id, idx, title, body) values (?, ?, ?, ?)`, [
        pid,
        nextIdx,
        d.title,
        d.body ?? "",
      ]);
    }
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function deleteSectionAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  const id = String(formData.get("id"));
  if (!pid || !id) return;
  await query(`delete from agreement_sections where id = ? and pg_id = ?`, [id, pid]);
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
  try {
    await query(`update pg_accounts set owner_signature_url = ? where id = ?`, [url, pid]);
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }
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
  try {
    await query(
      `insert into tenant_agreements (pg_id, tenant_id, signature_url, accepted_at) values (?, ?, ?, now())
       on duplicate key update signature_url = values(signature_url), accepted_at = values(accepted_at)`,
      [me.pg_id, me.tenant_id, url],
    );
  } catch (error) {
    return { error: humanizeDbError(error as never, "Could not save your agreement.") };
  }
  redirect("/portal");
}
