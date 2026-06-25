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

/** Per-month paid/due timeline for one tenant, from check-in to the current
 *  month, plus the next date the admin should collect on. `paidStatus` maps a
 *  "YYYY-MM" to a recorded payment status ("paid" | "partial"). */
export function tenantSchedule(
  checkinISO: string,
  rentDueDay: number,
  paidStatus: Map<string, "paid" | "partial">,
  today = new Date(),
): { timeline: MonthDue[]; nextDueDate: string | null; pendingMonths: number } {
  const todayISO = today.toISOString().slice(0, 10);
  const startMonth = checkinISO.slice(0, 7);
  const curMonth = todayISO.slice(0, 7);
  const months = monthsFromTo(startMonth, curMonth);

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
  const nextDueDate = owed ? owed.dueDate : dueDateFor(addMonths(curMonth, 1), rentDueDay);

  return { timeline, nextDueDate, pendingMonths };
}
