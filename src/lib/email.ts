import "server-only";
import { Resend } from "resend";

/**
 * Transactional email (renewal follow-ups, receipts).
 *
 * NOTE: Supabase auth mail (password recovery, invites) does NOT go through
 * here — Supabase sends those itself. Route those via custom SMTP in the
 * dashboard (smtp.resend.com:465, user "resend", pass = RESEND_API_KEY).
 */
const FROM = "PG360 <onboarding@resend.dev>"; // TODO: noreply@pg360.software once the domain is verified

let client: Resend | null = null;
function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<SendResult> {
  const r = resend();
  if (!r) return { ok: false, error: "RESEND_API_KEY is not set." };

  try {
    const { data, error } = await r.emails.send({ from: FROM, ...opts });
    if (error) {
      console.error("[email] send failed:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown email error.";
    console.error("[email] send threw:", msg);
    return { ok: false, error: msg };
  }
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
