/* =========================================================================
   Rent scheduling helpers — derive due dates, stay length and per-month paid/
   due status purely from a tenant's check-in date, rent-due day and recorded
   payments. No extra schema. Powers the rent calendar + collection reminders.
   ========================================================================= */

export type DueStatus = "paid" | "partial" | "overdue" | "upcoming";

/** "YYYY-MM" + a day-of-month → an ISO date, clamping the day to month length. */
export function dueDateFor(month: string, rentDueDay: number): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y!, m!, 0).getDate(); // day 0 of next month = last of this
  const day = Math.min(Math.max(rentDueDay || 1, 1), last);
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** Shift a "YYYY-MM" by n months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y!, m! - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Inclusive list of "YYYY-MM" from start to end. */
export function monthsFromTo(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  // guard against bad input — cap at 120 months
  for (let i = 0; i < 120 && cur <= end; i++) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

/** Ordinal day, e.g. 1 -> "1st", 2 -> "2nd", 22 -> "22nd". */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

/** Whole + remainder stay length from a check-in date to today. */
export function stayDuration(checkinISO: string, today = new Date()): {
  days: number;
  months: number;
  label: string;
} {
  const start = new Date(checkinISO);
  const days = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
  let months =
    (today.getFullYear() - start.getFullYear()) * 12 +
    (today.getMonth() - start.getMonth());
  if (today.getDate() < start.getDate()) months -= 1;
  months = Math.max(0, months);
  const remDays = days - months * 30;
  const label =
    months <= 0
      ? `${days} day${days === 1 ? "" : "s"}`
      : `${months} month${months === 1 ? "" : "s"}${remDays > 0 ? ` ${remDays} day${remDays === 1 ? "" : "s"}` : ""}`;
  return { days, months, label };
}

export interface MonthDue {
  month: string;
  dueDate: string;
  status: DueStatus;
}

/** Whole days from a → b (b exclusive), never negative. */
function dayDiff(aISO: string, bISO: string): number {
  const a = new Date(aISO + "T00:00:00").getTime();
  const b = new Date(bISO + "T00:00:00").getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** The first regular rent-due date on or after the check-in date — the start of
 *  the monthly cycle. With a 1st-of-month schedule: check-in 17 Jun → 1 Jul;
 *  check-in exactly on the 1st → that same 1st (no partial period). */
export function firstDueAfter(checkinISO: string, rentDueDay: number): string {
  const checkin = checkinISO.slice(0, 10);
  const month = checkin.slice(0, 7);
  let due = dueDateFor(month, rentDueDay);
  if (due < checkin) due = dueDateFor(addMonths(month, 1), rentDueDay);
  return due;
}

export interface FirstPeriod {
  fromISO: string; // check-in date
  toISO: string; // first regular due date (period end, exclusive)
  days: number; // pro-rata days billed
  isProRata: boolean; // false when the tenant joined exactly on the due day
  dailyRate: number; // monthly ÷ 30 (whole rupees)
  amount: number; // dailyRate × days (or full month when not pro-rata)
  status: DueStatus;
}

/** The first (partial) rent period from check-in to the first regular due date,
 *  billed pro-rata at monthly ÷ 30 per day. E.g. check-in 17 Jun, rent due on
 *  the 1st, ₹7,000/mo → 17 Jun–1 Jul, 14 days, ₹233/day, ₹3,267. */
export function firstProRataPeriod(
  checkinISO: string,
  rentDueDay: number,
  monthlyRent: number,
  paidStatus: Map<string, "paid" | "partial">,
  today = new Date(),
): FirstPeriod {
  const from = checkinISO.slice(0, 10);
  const to = firstDueAfter(from, rentDueDay);
  const days = dayDiff(from, to);
  // a partial period exists only when the tenant arrived before the cycle's
  // first due date (i.e. mid-month); joining exactly on the due day = no pro-rata
  const isProRata = days > 0;
  const dailyRate = Math.round(monthlyRent / 30);
  const amount = isProRata ? Math.round((monthlyRent / 30) * days) : monthlyRent;

  const recorded = paidStatus.get(from.slice(0, 7));
  const todayISO = today.toISOString().slice(0, 10);
  const status: DueStatus =
    recorded === "paid" ? "paid" : recorded === "partial" ? "partial" : from < todayISO ? "overdue" : "upcoming";

  return { fromISO: from, toISO: to, days, isProRata, dailyRate, amount, status };
}

export interface CurrentRent {
  amount: number; // what to collect this month (first month = rent + deposit + joining)
  proRata: boolean; // true while in the first (partial) month
  rent: number; // the rent portion
  deposit: number; // security deposit added in the first month
  joining: number; // joining / admission fee added in the first month
  days: number; // pro-rata days (0 when not a partial month)
}

/** What to actually collect from a monthly tenant right now. In the first
 *  (partial) month this is the pro-rata rent PLUS the one-time security deposit
 *  and joining fee; from the next month it's just the full rent. Shared by the
 *  tenants list and the payments page so both show the same figure. Day-wise
 *  tenants always show their stored amount. */
export function currentMonthRent(
  t: {
    rent_amount: number;
    checkin_date: string;
    rent_due_day: number;
    stay_type?: "monthly" | "daily" | null;
  },
  extras?: { securityDeposit?: number; joiningFee?: number },
  today = new Date(),
): CurrentRent {
  const plain = (amount: number): CurrentRent => ({ amount, proRata: false, rent: amount, deposit: 0, joining: 0, days: 0 });
  if (t.stay_type === "daily") return plain(t.rent_amount);
  const fp = firstProRataPeriod(t.checkin_date, t.rent_due_day, t.rent_amount, new Map(), today);
  const todayISO = today.toISOString().slice(0, 10);
  const checkinMonth = t.checkin_date.slice(0, 7);
  const inProRataWindow = fp.isProRata && todayISO <= fp.toISO;
  // "First month" = the check-in calendar month, or the still-open pro-rata
  // window of a mid-month join. In the first month we collect rent + the one-time
  // security deposit + joining fee (whether or not the rent itself is pro-rata —
  // e.g. a tenant who joined exactly on the rent-due day still owes the deposit).
  const isFirstMonth = todayISO.slice(0, 7) === checkinMonth || inProRataWindow;
  if (isFirstMonth) {
    const rent = inProRataWindow ? fp.amount : t.rent_amount;
    const deposit = extras?.securityDeposit ?? 0;
    const joining = extras?.joiningFee ?? 0;
    return {
      amount: rent + deposit + joining,
      proRata: true,
      rent,
      deposit,
      joining,
      days: inProRataWindow ? fp.days : 30,
    };
  }
  return plain(t.rent_amount);
}

/** Per-month paid/due timeline for one tenant. The check-in month's partial
 *  rent is handled separately (see firstProRataPeriod); this covers the regular
 *  monthly cycle from the first full due date onward, plus the next date the
 *  admin should collect on. `paidStatus` maps a "YYYY-MM" to a recorded payment
 *  status ("paid" | "partial"). */
export function tenantSchedule(
  checkinISO: string,
  rentDueDay: number,
  paidStatus: Map<string, "paid" | "partial">,
  today = new Date(),
): { timeline: MonthDue[]; nextDueDate: string | null; pendingMonths: number } {
  const todayISO = today.toISOString().slice(0, 10);
  const checkinDate = checkinISO.slice(0, 10);
  // the regular cycle starts on the first due date after check-in (the 1st of
  // the next month for a mid-month join), so the "next collection" reflects the
  // rent-due-day schedule, not the arrival date.
  const firstDue = firstDueAfter(checkinDate, rentDueDay);
  const startMonth = firstDue.slice(0, 7);
  const curMonth = todayISO.slice(0, 7);
  const lastMonth = curMonth >= startMonth ? curMonth : startMonth;
  const months = monthsFromTo(startMonth, lastMonth);

  const timeline: MonthDue[] = months.map((month) => {
    const dueDate = dueDateFor(month, rentDueDay);
    const recorded = paidStatus.get(month);
    let status: DueStatus;
    if (recorded === "paid") status = "paid";
    else if (recorded === "partial") status = "partial";
    else status = dueDate < todayISO ? "overdue" : "upcoming";
    return { month, dueDate, status };
  });

  const pendingMonths = timeline.filter((t) => t.status === "overdue" || t.status === "partial").length;

  // next collection date: the earliest still-owed month, else next month's due day
  const owed = timeline.find((t) => t.status !== "paid");
  const nextDueDate = owed ? owed.dueDate : dueDateFor(addMonths(lastMonth, 1), rentDueDay);

  return { timeline, nextDueDate, pendingMonths };
}
