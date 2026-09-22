import "server-only";
import { query, getPool } from "./mysql/client";
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

/** Whole days from a -> b (negative when b is before a). */
function dayDiffISO(aISO: string, bISO: string): number {
  const a = new Date(aISO + "T00:00:00Z").getTime();
  const b = new Date(bISO + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

export interface StayCycle {
  end: string;
  prevEnd: string | null;
  cycleNumber: number;
}

/** The rolling 30-day cycle a monthly tenant is currently in. Check-in on the
 *  1st -> cycle ends on the 31st, 60th day, ... (alert fires from the 28th). */
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
  room_number: string | null;
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
    room: t.room_number ?? "—",
    phone: t.phone,
    cycle_end: cycleEnd,
    stay_type: t.stay_type,
  });

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

  if (prevEnd && !resolved.has(prevEnd) && daysLeft > RENEWAL_LEAD_DAYS) {
    return { ...base(prevEnd), days_left: dayDiffISO(todayISO, prevEnd), kind: "overstay" };
  }
  if (daysLeft <= RENEWAL_LEAD_DAYS && !resolved.has(end)) {
    return { ...base(end), days_left: daysLeft, kind: daysLeft === 0 ? "ends_today" : "window" };
  }
  return null;
}

/* --------------------------------------------------------------- queries */

async function alertsForPg(pgId: string, todayISO: string): Promise<RenewalAlert[]> {
  const [tenants, checks] = await Promise.all([
    query<TenantLite>(
      `select t.id, t.pg_id, t.name, t.phone, t.checkin_date, t.stay_type, t.stay_days,
              r.room_number as room_number
         from tenants t
         left join rooms r on r.id = t.room_id
        where t.pg_id = ? and t.status = 'active'`,
      [pgId],
    ),
    query<{ tenant_id: string; cycle_end: string }>(
      `select tenant_id, cycle_end from renewal_checks where pg_id = ? and decision is not null`,
      [pgId],
    ),
  ]);
  const resolvedBy = new Map<string, Set<string>>();
  for (const c of checks) {
    (resolvedBy.get(c.tenant_id) ?? resolvedBy.set(c.tenant_id, new Set()).get(c.tenant_id)!).add(c.cycle_end);
  }
  return tenants
    .map((t) => computeRenewalAlert(t, resolvedBy.get(t.id) ?? new Set(), todayISO))
    .filter((a): a is RenewalAlert => a !== null)
    .sort((a, b) => a.days_left - b.days_left);
}

/** Pending renewal checks for the active property (dashboard card). */
export async function listRenewalAlerts(): Promise<RenewalAlert[]> {
  const pid = await getActiveProperty();
  if (!pid) return [];
  return alertsForPg(pid, new Date().toISOString().slice(0, 10));
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
 *  cycle end. `INSERT IGNORE` (MySQL's no-conflict-error insert) + affectedRows
 *  replaces Supabase's `ignoreDuplicates: true` + `.select()` — that pattern
 *  returned only the rows that were actually new in one bulk call; MySQL's
 *  bulk insert doesn't expose that per-row, so this inserts one at a time and
 *  checks each affectedRows (1 = fresh, 0 = already existed) — alert lists
 *  are small (a handful of near-renewal tenants), so the per-row round trip
 *  cost here is negligible. Best-effort — never blocks page render. */
async function notifyAlerts(alerts: RenewalAlert[]): Promise<number> {
  if (alerts.length === 0) return 0;
  const toSend: RenewalAlert[] = [];
  for (const a of alerts) {
    if (await insertRenewalCheckIfNew(a)) toSend.push(a);
  }
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

async function insertRenewalCheckIfNew(a: RenewalAlert): Promise<boolean> {
  const [result] = await getPool().query(
    `insert ignore into renewal_checks (pg_id, tenant_id, cycle_end, notified_at) values (?, ?, ?, now())`,
    [a.pg_id, a.tenant_id, a.cycle_end],
  );
  return (result as { affectedRows: number }).affectedRows === 1;
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

/** Sweep EVERY active property — for the scheduled cron hit, so alerts fire
 *  even on days no admin opens the dashboard. */
export async function sweepAllProperties(): Promise<{ pgs: number; notified: number }> {
  const todayISO = new Date().toISOString().slice(0, 10);
  const pgs = await query<{ id: string }>(`select id from pg_accounts where status = 'active'`);
  let notified = 0;
  for (const pg of pgs) {
    const alerts = await alertsForPg(pg.id, todayISO);
    notified += await notifyAlerts(alerts);
  }
  return { pgs: pgs.length, notified };
}
