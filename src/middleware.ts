import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Refreshes the Supabase session and bounces anonymous visitors away from
 * protected areas. The authoritative role check happens in each route-group
 * layout (requireRole), where the profile is resolved.
 */
const PROTECTED = ["/platform", "/dashboard", "/portal"];

export async function middleware(req: NextRequest) {
  const { response, user } = await updateSession(req);
  const { pathname } = req.nextUrl;

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/platform/:path*", "/dashboard/:path*", "/portal/:path*"],
};
