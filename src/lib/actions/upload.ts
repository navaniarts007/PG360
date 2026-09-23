"use server";

import { humanizeDbError } from "../errors";
import { revalidatePath } from "next/cache";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { query, queryOne } from "../mysql/client";
import { VPS_MARKER } from "../storage/vps";

/** Admin saves the PG's payment details (UPI + bank) and/or QR image URL,
 *  scoped to the caller's own active property. */
export async function savePaymentDetailsAction(
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  // pg_accounts writes are admin-only (see RLS_TO_APP_LAYER.md) — staff must
  // not be able to change the property's UPI/bank/QR payment details.
  await requireRole(["admin"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const upi = String(formData.get("upi_id") ?? "").trim();
  const bank = String(formData.get("bank_details") ?? "").trim();
  const qr = String(formData.get("payment_qr_url") ?? "").trim();
  if (qr && !VPS_MARKER.test(qr)) return { error: "Invalid QR URL." };

  try {
    if (qr) {
      await query(`update pg_accounts set upi_id = ?, bank_details = ?, payment_qr_url = ? where id = ?`, [
        upi || null,
        bank || null,
        qr,
        pid,
      ]);
    } else {
      await query(`update pg_accounts set upi_id = ?, bank_details = ? where id = ?`, [
        upi || null,
        bank || null,
        pid,
      ]);
    }
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }
  revalidatePath("/dashboard/payments");
  revalidatePath("/portal/bill");
  return { ok: true };
}

/** Persist the uploaded screenshot URL onto the tenant's own payment —
 *  verifies ownership before writing, only ever touches that one column. */
export async function savePaymentScreenshotAction(
  paymentId: string,
  url: string,
): Promise<{ ok?: boolean; error?: string }> {
  const me = await requireRole(["tenant"]);
  if (!me.tenant_id) return { error: "No tenant record." };
  if (!/^https:\/\/res\.cloudinary\.com\//.test(url)) {
    return { error: "Invalid upload URL." };
  }
  const payment = await queryOne<{ id: string; tenant_id: string }>(
    `select id, tenant_id from payments where id = ?`,
    [paymentId],
  );
  if (!payment || payment.tenant_id !== me.tenant_id) {
    return { error: "That payment isn't yours." };
  }
  try {
    await query(`update payments set payment_screenshot_url = ? where id = ?`, [url, paymentId]);
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }
  revalidatePath("/portal/bill");
  revalidatePath("/dashboard/payments");
  return { ok: true };
}

/** Save or update the Rules & Regulations document URL for the current PG
 *  property. The original had a "column may not exist yet, fall back to
 *  settings JSONB" defensive path for an in-flight Supabase migration —
 *  irrelevant here, this schema always has rules_doc_url as a real column. */
export async function saveRulesDocumentAction(
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const docUrl = String(formData.get("rules_doc_url") ?? "").trim();

  try {
    await query(`update pg_accounts set rules_doc_url = ? where id = ?`, [docUrl || null, pid]);
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/portal");
  revalidatePath("/portal/account");
  return { ok: true };
}
