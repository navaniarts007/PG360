import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Exchanges the one-time `code` from a Supabase email link (password recovery /
 *  magic link) for a session, setting the auth cookies, then forwards to `next`.
 *  Redirects on the same origin the link was opened on so cookies persist. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const base = forwardedHost ? `${proto}://${forwardedHost}` : url.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}${next}`);
  }
  return NextResponse.redirect(`${base}/forgot-password?expired=1`);
}
