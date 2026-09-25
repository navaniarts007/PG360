import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Exchanges the one-time `code` from a Supabase email link (password recovery /
 *  magic link) or an OAuth redirect (Google) for a session, setting the auth
 *  cookies, then forwards to `next`. Redirects on the same origin the link/flow
 *  was opened on so cookies persist. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const base = forwardedHost ? `${proto}://${forwardedHost}` : url.origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // OAuth (Google) signs in/up freely, but PG360 accounts are provisioned
      // by an admin, not self-serve — a Google identity with no matching
      // profiles row has nowhere to land, so it can't be treated as signed in.
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!profile) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${base}/login?error=no_profile`);
      }
      return NextResponse.redirect(`${base}${next}`);
    }
  }
  return NextResponse.redirect(
    `${base}${next === "/dashboard" ? "/login?error=link_expired" : "/forgot-password?expired=1"}`,
  );
}
