import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, addMonths } from "@/lib/rent";
import { inr } from "@/lib/utils";
import type { BillRow } from "@/lib/db";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A month grid placing each tenant on their rent-due day, coloured by whether
 *  the rent for that month is paid / partial / overdue. Month nav via ?m=. */
export function CollectionCalendar({ month, rows }: { month: string; rows: BillRow[] }) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [y, m] = month.split("-").map(Number);
  const firstWeekday = new Date(y!, m! - 1, 1).getDay();
  const daysInMonth = new Date(y!, m!, 0).getDate();

  // group tenants by their due day-of-month
  const byDay = new Map<number, BillRow[]>();
  for (const r of rows) {
    const day = Number(r.due_date.slice(8, 10));
    (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(r);
  }

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const tone = (r: BillRow) => {
    if (r.status === "paid") return "bg-teal-50 text-teal-700 ring-teal-100";
    if (r.status === "partial") return "bg-gold-50 text-gold-700 ring-gold-100";
    const due = r.due_date < todayISO;
    return due ? "bg-rose-50 text-rose-700 ring-rose-100" : "bg-clay-50 text-clay-700 ring-clay-100";
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/dashboard/calendar?m=${addMonths(month, -1)}`}
          className="grid size-9 place-items-center rounded-lg border border-line text-ink-soft hover:text-clay-600"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h3 className="font-display text-lg font-semibold text-ink">{monthLabel(month)}</h3>
        <Link
          href={`/dashboard/calendar?m=${addMonths(month, 1)}`}
          className="grid size-9 place-items-center rounded-lg border border-line text-ink-soft hover:text-clay-600"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[5.5rem] rounded-lg" />;
          const dueHere = byDay.get(day) ?? [];
          const isToday = `${month}-${String(day).padStart(2, "0")}` === todayISO;
          return (
            <div
              key={i}
              className={`min-h-[5.5rem] rounded-lg border p-1.5 ${isToday ? "border-clay-400 bg-clay-50/40" : "border-line bg-paper-2/20"}`}
            >
              <span className={`text-xs font-semibold ${isToday ? "text-clay-700" : "text-ink-muted"}`}>{day}</span>
              <div className="mt-1 space-y-1">
                {dueHere.slice(0, 3).map((r) => (
                  <Link
                    key={r.tenant_id}
                    href={`/dashboard/tenants/${r.tenant_id}`}
                    className={`block truncate rounded px-1.5 py-0.5 text-[0.68rem] font-medium ring-1 ${tone(r)}`}
                    title={`${r.name} · ${inr(r.balance > 0 ? r.balance : r.total)} · ${r.status}`}
                  >
                    {r.name}
                  </Link>
                ))}
                {dueHere.length > 3 && (
                  <span className="block px-1.5 text-[0.65rem] text-ink-muted">+{dueHere.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[0.7rem] text-ink-muted">
        <Legend cls="bg-rose-100" label="Overdue" />
        <Legend cls="bg-clay-100" label="Due (upcoming)" />
        <Legend cls="bg-gold-100" label="Partial" />
        <Legend cls="bg-teal-100" label="Paid" />
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded ${cls}`} /> {label}
    </span>
  );
}
