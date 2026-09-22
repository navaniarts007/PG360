"use server";

import { createHash } from "node:crypto";
import { humanizeDbError } from "../errors";
import { revalidatePath } from "next/cache";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { query, queryOne } from "../mysql/client";

export type SignResult =
  | {
      ok: true;
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      folder: string;
    }
  | { ok: false; error: string };

const FOLDERS = ["pg360/payments", "pg360/qr", "pg360/avatars", "pg360/kyc", "pg360/docs"] as const;
type Folder = (typeof FOLDERS)[number];

/** Returns a short-lived signature so the browser can upload directly to
 *  Cloudinary without ever seeing the API secret. */
export async function getUploadSignatureAction(
  folder: Folder = "pg360/payments",
): Promise<SignResult> {
  await requireRole(["tenant", "admin", "staff"]);
  if (!FOLDERS.includes(folder)) return { ok: false, error: "Bad upload target." };
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return { ok: false, error: "Uploads aren't configured." };
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(toSign + apiSecret).digest("hex");
  return { ok: true, cloudName, apiKey, timestamp, signature, folder };
}

export type KycSignResult =
  | {
      ok: true;
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      folder: string;
    }
  | { ok: false; error: string };

/** Signature for uploading an Aadhaar/KYC document to Cloudinary as an
 *  AUTHENTICATED (private) asset — it can't be delivered without a signed URL,
 *  so the raw link can't be opened by just anyone. */
export async function getKycUploadSignatureAction(): Promise<KycSignResult> {
  await requireRole(["admin", "staff"]);
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return { ok: false, error: "Uploads aren't configured." };
  }
  const folder = "pg360/kyc";
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `folder=${folder}&timestamp=${timestamp}&type=authenticated`;
  const signature = createHash("sha1").update(toSign + apiSecret).digest("hex");
  return { ok: true, cloudName, apiKey, timestamp, signature, folder };
}

/** Signature for uploading a SIGNATURE (resident or owner) to Cloudinary as a
 *  private authenticated asset. Tenants may upload (their own signature). */
export async function getSignatureUploadSignatureAction(): Promise<KycSignResult> {
  await requireRole(["tenant", "admin", "staff"]);
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return { ok: false, error: "Uploads aren't configured." };
  }
  const folder = "pg360/signatures";
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `folder=${folder}&timestamp=${timestamp}&type=authenticated`;
  const signature = createHash("sha1").update(toSign + apiSecret).digest("hex");
  return { ok: true, cloudName, apiKey, timestamp, signature, folder };
}

/** Admin saves the PG's payment details (UPI + bank) and/or QR image URL,
 *  scoped to the caller's own active property. */
export async function savePaymentDetailsAction(
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const upi = String(formData.get("upi_id") ?? "").trim();
  const bank = String(formData.get("bank_details") ?? "").trim();
  const qr = String(formData.get("payment_qr_url") ?? "").trim();
  if (qr && !/^https:\/\/res\.cloudinary\.com\//.test(qr)) return { error: "Invalid QR URL." };

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
