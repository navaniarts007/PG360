import { CalendarDays, CircleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  dueDateFor,
  monthLabel,
  stayDuration,
  tenantSchedule,
  type DueStatus,
} from "@/lib/rent";
import { formatDate } from "@/lib/utils";
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
  payments,
}: {
  checkinDate: string;
  rentDueDay: number;
  payments: Payment[];
}) {
  const paidStatus = new Map<string, "paid" | "partial">();
  for (const p of payments) {
    if (p.status === "paid" || p.status === "partial") paidStatus.set(p.month_for, p.status);
  }

  const { timeline, nextDueDate, pendingMonths } = tenantSchedule(checkinDate, rentDueDay, paidStatus);
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
