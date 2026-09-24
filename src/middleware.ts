import { NextResponse, type NextRequest } from "next/server";

/**
 * Coarse gate: bounces anonymous visitors away from protected areas based
 * on cookie presence alone. Middleware doesn't hit MySQL (no Node runtime
 * DB call per request, on every route) — the authoritative check (session
 * validity, expiry, role) happens in each route-group layout via
 * requireRole() -> getSession(), same as it did before this cookie was
 * Supabase's. A stale/expired-but-present cookie still reaches that check
 * and gets redirected there; this layer only stops the no-cookie-at-all case.
 */
const PROTECTED = ["/platform", "/dashboard", "/portal"];
const SESSION_COOKIE = "pg360_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value;

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !hasSession) {
    const url = req.nextUrl.clone();
    // Behind the client VPS's .htaccess proxy, req.nextUrl carries
    // 127.0.0.1:3001 (there's no root access to set ProxyPreserveHost in
    // that vhost), so the redirect must use the forwarded public hostname
    // instead or it sends the browser to an unreachable internal address.
    const fwdHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    if (fwdHost) {
      url.host = fwdHost;
      url.port = "";
      url.protocol = (req.headers.get("x-forwarded-proto") ?? "https") + ":";
    }
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/platform/:path*", "/dashboard/:path*", "/portal/:path*"],
};
