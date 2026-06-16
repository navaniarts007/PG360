"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "../guards";
import { createAdminClient } from "../supabase/admin";

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

/** Returns a short-lived signature so the browser can upload directly to
 *  Cloudinary without ever seeing the API secret. */
export async function getUploadSignatureAction(): Promise<SignResult> {
  await requireRole(["tenant", "admin", "staff"]);
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return { ok: false, error: "Uploads aren't configured." };
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "pg360/payments";
  // sign the params (sorted) + secret
  const toSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(toSign + apiSecret).digest("hex");
  return { ok: true, cloudName, apiKey, timestamp, signature, folder };
}

/** Persist the uploaded screenshot URL onto the tenant's own payment. Uses the
 *  service client but verifies ownership, and only ever writes that one column. */
export async function savePaymentScreenshotAction(
  paymentId: string,
  url: string,
): Promise<{ ok?: boolean; error?: string }> {
  const me = await requireRole(["tenant"]);
  if (!me.tenant_id) return { error: "No tenant record." };
  if (!/^https:\/\/res\.cloudinary\.com\//.test(url)) {
    return { error: "Invalid upload URL." };
  }
  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, tenant_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.tenant_id !== me.tenant_id) {
    return { error: "That payment isn't yours." };
  }
  const { error } = await admin
    .from("payments")
    .update({ payment_screenshot_url: url })
    .eq("id", paymentId);
  if (error) return { error: error.message };
  revalidatePath("/portal/bill");
  revalidatePath("/dashboard/payments");
  return { ok: true };
}
