import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RenewalButtons } from "./renewal-buttons";
import type { RenewalAlert } from "@/lib/renewals";
import { formatDate } from "@/lib/utils";

function statusLine(a: RenewalAlert): { text: string; urgent: boolean } {
  if (a.kind === "overstay") {
    const over = Math.abs(a.days_left);
    return {
      text: `Cycle ended ${formatDate(a.cycle_end)} · ${over} day${over === 1 ? "" : "s"} unconfirmed`,
      urgent: true,
    };
  }
  if (a.kind === "ends_today") return { text: "30-day stay ends today", urgent: true };
  return {
    text: `30-day stay ends ${formatDate(a.cycle_end)} · ${a.days_left} day${a.days_left === 1 ? "" : "s"} left`,
    urgent: false,
  };
}

/** Shift-out / renewal follow-ups: tenants whose rolling 30-day cycle completes
 *  within 3 days (or already lapsed unconfirmed). Staff record the tenant's
 *  answer in place — Staying rolls them into the next cycle, Leaving flags the
 *  bed as coming free (no refunds mid-cycle, so this is purely a heads-up). */
export function RenewalAlertsCard({ alerts }: { alerts: RenewalAlert[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between p-5 sm:p-6">
        <div>
          <h3 className="flex items-center gap-2 text-lg text-ink">
            <CalendarClock className="size-4.5 text-clay-500" /> Renewals to confirm
          </h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            30-day stays ending soon — ask each tenant: staying or leaving?
          </p>
        </div>
      </div>
      {alerts.length === 0 ? (
        <div className="p-6 pt-0">
          <EmptyState
            icon={CalendarClock}
            title="No renewals due"
            body="Nobody completes a 30-day cycle in the next 3 days."
          />
        </div>
      ) : (
        <div className="divide-y divide-line border-t border-line">
          {alerts.map((a) => {
            const { text, urgent } = statusLine(a);
            return (
              <div
                key={`${a.tenant_id}-${a.cycle_end}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-clay-50 text-xs font-bold text-clay-600">
                    {a.room}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/tenants/${a.tenant_id}`}
                      className="block truncate text-sm font-semibold text-ink hover:text-clay-700"
                    >
                      {a.name}
                    </Link>
                    <p
                      className={`flex items-center gap-1 text-xs ${urgent ? "font-semibold text-rose-600" : "text-ink-muted"}`}
                    >
                      {a.kind === "overstay" && <AlertTriangle className="size-3" />}
                      {text}
                    </p>
                  </div>
                </div>
                <RenewalButtons tenantId={a.tenant_id} cycleEnd={a.cycle_end} />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
