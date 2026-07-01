import { CalendarDays, CircleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  dueDateFor,
  firstProRataPeriod,
  monthLabel,
  stayDuration,
  tenantSchedule,
  type DueStatus,
} from "@/lib/rent";
import { addDaysISO } from "@/lib/money";
import { formatDate, inr } from "@/lib/utils";
import type { Payment } from "@/lib/types";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const STATUS_DOT: Record<DueStatus, string> = {
  paid: "bg-teal-500",
  partial: "bg-gold-500",
  overdue: "bg-rose-500",
  upcoming: "bg-ink-muted/40",
};
const STATUS_CHIP: Record<DueStatus, string> = {
  paid: "bg-teal-50 text-teal-700 ring-teal-100",
  partial: "bg-gold-50 text-gold-700 ring-gold-100",
  overdue: "bg-rose-50 text-rose-700 ring-rose-100",
  upcoming: "bg-paper-2 text-ink-muted ring-line",
};

/** A compact rent calendar for one tenant: how long they've stayed, the rent-due
 *  day, the next collection date, a month-by-month paid/due strip, and a mini
 *  month grid with the due day circled. */
export function RentCalendarCard({
  checkinDate,
  rentDueDay,
  monthlyRent,
  payments,
  stayType = "monthly",
  dailyRate,
  stayDays,
}: {
  checkinDate: string;
  rentDueDay: number;
  monthlyRent: number;
  payments: Payment[];
  stayType?: "monthly" | "daily";
  dailyRate?: number | null;
  stayDays?: number | null;
}) {
  // Day-wise stay: one fixed window, billed once — show a stay summary instead
  // of a monthly cycle.
  if (stayType === "daily") {
    const days = stayDays ?? 0;
    const rate = dailyRate ?? 0;
    const total = Math.round(rate * days);
    const end = addDaysISO(checkinDate, days);
    const paid = payments
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + p.amount_paid, 0);
    const settled = paid >= total && total > 0;
    return (
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4.5 text-clay-500" />
          <h3 className="text-lg text-ink">Stay &amp; billing</h3>
        </div>
        <span className="mt-2 inline-flex rounded-full bg-clay-50 px-2.5 py-0.5 text-xs font-semibold text-clay-700 ring-1 ring-clay-100">
          Day-wise · {days} day{days === 1 ? "" : "s"}
        </span>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Info label="Check-in" value={formatDate(checkinDate)} />
          <Info label="Expected check-out" value={formatDate(end)} />
          <Info label="Daily rate" value={inr(rate)} />
          <Info label="Total for stay" value={inr(total)} />
        </div>
        <div
          className={`mt-4 flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
            settled ? "bg-teal-50 text-teal-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          <span className="font-semibold">{settled ? "Paid in full" : "Payment pending"}</span>
          <span className="tnum">{inr(paid)} / {inr(total)}</span>
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Billed once for the whole stay — collect on arrival. No monthly due dates.
        </p>
      </Card>
    );
  }

  const paidStatus = new Map<string, "paid" | "partial">();
  for (const p of payments) {
    if (p.status === "paid" || p.status === "partial") paidStatus.set(p.month_for, p.status);
  }

  const { timeline, nextDueDate, pendingMonths } = tenantSchedule(checkinDate, rentDueDay, paidStatus);
  const firstPeriod = firstProRataPeriod(checkinDate, rentDueDay, monthlyRent, paidStatus);
  const stay = stayDuration(checkinDate);
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const overdue = !!nextDueDate && nextDueDate < todayISO && pendingMonths > 0;

  // mini grid for the next-due month (or current month)
  const focusMonth = (nextDueDate ?? todayISO).slice(0, 7);
  const focusStatus = timeline.find((t) => t.month === focusMonth)?.status ?? "upcoming";
  const dueDay = Number(dueDateFor(focusMonth, rentDueDay).slice(8, 10));
  const [fy, fm] = focusMonth.split("-").map(Number);
  const firstWeekday = new Date(fy!, fm! - 1, 1).getDay();
  const daysInMonth = new Date(fy!, fm!, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-4.5 text-clay-500" />
        <h3 className="text-lg text-ink">Rent calendar</h3>
      </div>

      {/* summary */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Info label="Checked in" value={formatDate(checkinDate)} />
        <Info label="Staying" value={stay.label} />
        <Info label="Rent due day" value={`${rentDueDay}${ordinal(rentDueDay)} of each month`} />
        <Info
          label="Next collection"
          value={nextDueDate ? formatDate(nextDueDate) : "—"}
          tone={overdue ? "rose" : "ink"}
        />
      </div>

      {/* first (partial) rent period — daily pro-rata from check-in to the 1st */}
      {firstPeriod.isProRata && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 ${
            firstPeriod.status === "paid"
              ? "border-teal-200 bg-teal-50/60"
              : "border-clay-100 bg-clay-50/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              First period · pro-rata
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ring-1 ${STATUS_CHIP[firstPeriod.status]}`}
            >
              {firstPeriod.status === "paid" ? "Collected" : firstPeriod.status === "overdue" ? "Due now" : "Upcoming"}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-ink">
            {formatDate(firstPeriod.fromISO)} → {formatDate(firstPeriod.toISO)}
          </p>
          <div className="mt-1 flex items-baseline justify-between text-sm">
            <span className="text-ink-muted tnum">
              {firstPeriod.days} day{firstPeriod.days === 1 ? "" : "s"} × {inr(firstPeriod.dailyRate)}/day
            </span>
            <span className="font-display text-lg font-semibold text-ink tnum">{inr(firstPeriod.amount)}</span>
          </div>
          <p className="mt-1 text-[0.7rem] text-ink-muted">
            Collected on arrival. Full monthly rent then follows the {rentDueDay}
            {ordinal(rentDueDay)}-of-month schedule.
          </p>
        </div>
      )}

      {overdue && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-600">
          <CircleAlert className="size-4 shrink-0" />
          Payment pending — {pendingMonths} month{pendingMonths === 1 ? "" : "s"} to collect.
        </div>
      )}

      {/* mini month grid */}
      <div className="mt-5 rounded-xl border border-line bg-paper-2/30 p-4">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {monthLabel(focusMonth)}
        </p>
        <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] text-ink-muted">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="py-1 font-semibold">{d}</span>
          ))}
          {cells.map((day, i) => {
            const isDue = day === dueDay;
            return (
              <span
                key={i}
                className={`grid aspect-square place-items-center rounded-lg text-xs ${
                  !day
                    ? ""
                    : isDue
                      ? `font-bold text-white ${focusStatus === "paid" ? "bg-teal-500" : focusStatus === "partial" ? "bg-gold-500" : focusStatus === "overdue" ? "bg-rose-500" : "bg-clay-600"}`
                      : "text-ink-soft"
                }`}
              >
                {day ?? ""}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs text-ink-muted">
          Rent due on the circled date.
        </p>
      </div>

      {/* month-by-month strip */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Month-by-month
        </p>
        <div className="flex flex-wrap gap-1.5">
          {timeline.map((t) => (
            <span
              key={t.month}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_CHIP[t.status]}`}
              title={`${monthLabel(t.month)} · due ${formatDate(t.dueDate)}`}
            >
              <span className={`size-1.5 rounded-full ${STATUS_DOT[t.status]}`} />
              {monthLabel(t.month)}
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[0.7rem] text-ink-muted">
          <Legend dot="bg-teal-500" label="Paid" />
          <Legend dot="bg-gold-500" label="Partial" />
          <Legend dot="bg-rose-500" label="Overdue" />
          <Legend dot="bg-ink-muted/40" label="Upcoming" />
        </div>
      </div>
    </Card>
  );
}

function Info({ label, value, tone }: { label: string; value: string; tone?: "rose" | "ink" }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`font-semibold ${tone === "rose" ? "text-rose-600" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${dot}`} /> {label}
    </span>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0]!;
}
