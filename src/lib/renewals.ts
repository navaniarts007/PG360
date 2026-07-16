import "server-only";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { getActiveProperty } from "./auth";
import { notify, pgStaffUserIds } from "./notify";
import { formatDate } from "./utils";

/* =========================================================================
   Shift-out / renewal alerts. Every tenant runs on a rolling 30-day stay
   cycle anchored on their check-in date; 3 days before each cycle completes
   the admin is flagged to confirm whether the tenant extends or vacates
   (no refunds mid-cycle, so an unconfirmed stay = a lost booking). Day-wise
   tenants get the same flag before their fixed stay end. Decisions live in
   renewal_checks — one row per (tenant, cycle end).
   ========================================================================= */

export const CYCLE_DAYS = 30;
export const RENEWAL_LEAD_DAYS = 3;

/* ------------------------------------------------------- pure date math */

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from a → b (negative when b is before a). */
function dayDiffISO(aISO: string, bISO: string): number {
  const a = new Date(aISO + "T00:00:00Z").getTime();
  const b = new Date(bISO + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

export interface StayCycle {
  /** current cycle completion date (anchor + 30·n) */
  end: string;
  /** the previous cycle end, if one has already passed */
  prevEnd: string | null;
  cycleNumber: number;
}

/** The rolling 30-day cycle a monthly tenant is currently in. Check-in on the
 *  1st → cycle ends on the 31st, 60th day, … (alert fires from the 28th). */
export function currentStayCycle(anchorISO: string, todayISO: string): StayCycle {
  const d = dayDiffISO(anchorISO, todayISO);
  const n = Math.max(1, Math.ceil(d / CYCLE_DAYS));
  return {
    end: addDaysISO(anchorISO, CYCLE_DAYS * n),
    prevEnd: n > 1 ? addDaysISO(anchorISO, CYCLE_DAYS * (n - 1)) : null,
    cycleNumber: n,
  };
}

/** All cycle-end dates for an anchor that fall inside a "YYYY-MM" month —
 *  powers the renewal markers on the collection calendar. */
export function cycleEndsInMonth(anchorISO: string, month: string): string[] {
  const monthStart = `${month}-01`;
  const gap = dayDiffISO(anchorISO, monthStart);
  const out: string[] = [];
  // first multiple of 30 days landing on/after the 1st of the month
  for (let n = Math.max(1, Math.ceil(gap / CYCLE_DAYS)); ; n++) {
    const end = addDaysISO(anchorISO, CYCLE_DAYS * n);
    if (end.slice(0, 7) > month) break;
    if (end.slice(0, 7) === month) out.push(end);
  }
  return out;
}

export type RenewalKind = "window" | "ends_today" | "overstay";

export interface RenewalAlert {
  tenant_id: string;
  pg_id: string;
  name: string;
  room: string;
  phone: string;
  cycle_end: string;
  /** days until the cycle completes (negative = days overstayed) */
  days_left: number;
  kind: RenewalKind;
  stay_type: "monthly" | "daily";
}

interface TenantLite {
  id: string;
  pg_id: string;
  name: string;
  phone: string;
  checkin_date: string;
  stay_type: "monthly" | "daily";
  stay_days: number | null;
  room: { room_number: string } | null;
}

/** Decide whether a tenant needs a renewal check right now. `resolved` holds
 *  the cycle-end dates a decision has already been recorded for. */
export function computeRenewalAlert(
  t: TenantLite,
  resolved: Set<string>,
  todayISO: string,
): RenewalAlert | null {
  const base = (cycleEnd: string): Omit<RenewalAlert, "kind" | "days_left"> => ({
    tenant_id: t.id,
    pg_id: t.pg_id,
    name: t.name,
    room: t.room?.room_number ?? "—",
    phone: t.phone,
    cycle_end: cycleEnd,
    stay_type: t.stay_type,
  });

  // Day-wise stay: one fixed end date (check-in + stay days), no recurrence.
  if (t.stay_type === "daily") {
    if (!t.stay_days) return null;
    const end = addDaysISO(t.checkin_date.slice(0, 10), t.stay_days);
    if (resolved.has(end)) return null;
    const daysLeft = dayDiffISO(todayISO, end);
    if (daysLeft > RENEWAL_LEAD_DAYS) return null;
    const kind: RenewalKind = daysLeft < 0 ? "overstay" : daysLeft === 0 ? "ends_today" : "window";
    return { ...base(end), days_left: daysLeft, kind };
  }

  const { end, prevEnd } = currentStayCycle(t.checkin_date.slice(0, 10), todayISO);
  const daysLeft = dayDiffISO(todayISO, end);

  // last cycle completed without a recorded decision and the next check isn't
  // due yet — the tenant may be overstaying unannounced.
  if (prevEnd && !resolved.has(prevEnd) && daysLeft > RENEWAL_LEAD_DAYS) {
    return { ...base(prevEnd), days_left: dayDiffISO(todayISO, prevEnd), kind: "overstay" };
  }
  if (daysLeft <= RENEWAL_LEAD_DAYS && !resolved.has(end)) {
    return { ...base(end), days_left: daysLeft, kind: daysLeft === 0 ? "ends_today" : "window" };
  }
  return null;
}

/* --------------------------------------------------------------- queries */

type Client = Awaited<ReturnType<typeof createClient>>;

async function alertsForPg(s: Client, pgId: string, todayISO: string): Promise<RenewalAlert[]> {
  const [{ data: tenants }, { data: checks }] = await Promise.all([
    s
      .from("tenants")
      .select("id, pg_id, name, phone, checkin_date, stay_type, stay_days, room:rooms(room_number)")
      .eq("pg_id", pgId)
      .eq("status", "active"),
    s
      .from("renewal_checks")
      .select("tenant_id, cycle_end, decision")
      .eq("pg_id", pgId)
      .not("decision", "is", null),
  ]);
  const resolvedBy = new Map<string, Set<string>>();
  for (const c of (checks ?? []) as { tenant_id: string; cycle_end: string }[]) {
    (resolvedBy.get(c.tenant_id) ?? resolvedBy.set(c.tenant_id, new Set()).get(c.tenant_id)!).add(
      c.cycle_end,
    );
  }
  return ((tenants ?? []) as unknown as TenantLite[])
    .map((t) => computeRenewalAlert(t, resolvedBy.get(t.id) ?? new Set(), todayISO))
    .filter((a): a is RenewalAlert => a !== null)
    .sort((a, b) => a.days_left - b.days_left);
}

/** Pending renewal checks for the active property (dashboard card). */
export async function listRenewalAlerts(): Promise<RenewalAlert[]> {
  const s = await createClient();
  const pid = await getActiveProperty();
  if (!pid) return [];
  return alertsForPg(s, pid, new Date().toISOString().slice(0, 10));
}

/* ----------------------------------------------------------------- sweep */

function alertMessage(a: RenewalAlert): string {
  const when = formatDate(a.cycle_end);
  if (a.kind === "overstay")
    return `Overstay check: ${a.name} (Room ${a.room}) completed their 30-day stay on ${when} with no confirmation — verify extend or vacate.`;
  if (a.kind === "ends_today")
    return `Renewal check: ${a.name} (Room ${a.room}) completes their 30-day stay TODAY — confirm extend or vacate.`;
  return `Renewal check: ${a.name} (Room ${a.room}) completes their 30-day stay on ${when} (${a.days_left} day${a.days_left === 1 ? "" : "s"} left) — confirm extend or vacate.`;
}

/** Turn computed alerts into in-app notifications, exactly once per tenant per
 *  cycle end (the unique key dedupes). Best-effort — never blocks page render. */
async function notifyAlerts(alerts: RenewalAlert[]): Promise<number> {
  if (alerts.length === 0) return 0;
  const admin = createAdminClient();
  const { data: fresh } = await admin
    .from("renewal_checks")
    .upsert(
      alerts.map((a) => ({
        pg_id: a.pg_id,
        tenant_id: a.tenant_id,
        cycle_end: a.cycle_end,
        notified_at: new Date().toISOString(),
      })),
      { onConflict: "tenant_id,cycle_end", ignoreDuplicates: true },
    )
    .select("tenant_id, cycle_end");
  const freshKeys = new Set(
    ((fresh ?? []) as { tenant_id: string; cycle_end: string }[]).map(
      (r) => `${r.tenant_id}|${r.cycle_end}`,
    ),
  );
  const toSend = alerts.filter((a) => freshKeys.has(`${a.tenant_id}|${a.cycle_end}`));
  if (toSend.length === 0) return 0;

  const byPg = new Map<string, RenewalAlert[]>();
  for (const a of toSend) (byPg.get(a.pg_id) ?? byPg.set(a.pg_id, []).get(a.pg_id)!).push(a);
  for (const [pgId, list] of byPg) {
    const staff = await pgStaffUserIds(pgId);
    await notify(
      list.flatMap((a) =>
        staff.map((st) => ({
          pgId,
          recipientId: st.id,
          recipientType: st.role,
          message: alertMessage(a),
          link: `/dashboard/tenants/${a.tenant_id}`,
        })),
      ),
    );
  }
  return toSend.length;
}

/** Sweep the active property: compute alerts and fire any not-yet-sent
 *  notifications. Called on admin dashboard/calendar load (request-driven,
 *  like the rest of the app) — returns the alerts so pages render them. */
export async function sweepRenewalAlerts(): Promise<RenewalAlert[]> {
  const alerts = await listRenewalAlerts();
  try {
    await notifyAlerts(alerts);
  } catch {
    /* best-effort */
  }
  return alerts;
}

/** Sweep EVERY active property (service role) — for the scheduled cron hit,
 *  so alerts fire even on days no admin opens the dashboard. */
export async function sweepAllProperties(): Promise<{ pgs: number; notified: number }> {
  const admin = createAdminClient();
  const todayISO = new Date().toISOString().slice(0, 10);
  const { data: pgs } = await admin.from("pg_accounts").select("id").eq("status", "active");
  const ids = ((pgs ?? []) as { id: string }[]).map((p) => p.id);
  let notified = 0;
  for (const pgId of ids) {
    const alerts = await alertsForPg(admin as unknown as Client, pgId, todayISO);
    notified += await notifyAlerts(alerts);
  }
  return { pgs: ids.length, notified };
}
