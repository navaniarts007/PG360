import { NextResponse } from "next/server";
import { sweepAllProperties } from "@/lib/renewals";

export const dynamic = "force-dynamic";

/** Daily renewal sweep across every active property — fires the "30-day stay
 *  ends in 3 days" staff notifications even on days no admin opens the app.
 *  Point a scheduler at it (e.g. vercel.json cron, once a day):
 *    GET /api/cron/renewals  with  Authorization: Bearer <CRON_SECRET>
 *  The same sweep also runs on dashboard/calendar load, so this is a safety
 *  net, not the only trigger. Dedupe: one notification per tenant per cycle. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sweepAllProperties();
  return NextResponse.json({ ok: true, ...result });
}
