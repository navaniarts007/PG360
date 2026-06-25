import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { CollectionCalendar } from "@/components/admin/collection-calendar";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";
import { requireRole } from "@/lib/guards";
import { getMonthBill, getPayTenants } from "@/lib/db";
import { currentMonth, formatDate, inr } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  await requireRole(["admin", "staff"]);
  const { m } = await searchParams;
  const month = m && MONTH_RE.test(m) ? m : currentMonth();

  const [rows, payTenants] = await Promise.all([getMonthBill(month), getPayTenants()]);
  const todayISO = new Date().toISOString().slice(0, 10);

  const pending = rows
    .filter((r) => r.status !== "paid")
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Collections"
        title="Rent calendar"
        subtitle="Who pays on which date this month — collect on time, never miss a due date."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CollectionCalendar month={month} rows={rows} />
        </div>

        <Card>
          <div className="border-b border-line p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-lg text-ink">
              <CalendarDays className="size-4.5 text-clay-500" /> To collect
            </h3>
            <p className="mt-0.5 text-sm text-ink-muted">{pending.length} pending this month.</p>
          </div>
          {pending.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">All collected for {month}. 🎉</p>
          ) : (
            <div className="max-h-[28rem] divide-y divide-line overflow-y-auto">
              {pending.map((r) => {
                const overdue = r.due_date < todayISO;
                return (
                  <div key={r.tenant_id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                      <p className={`text-xs ${overdue ? "font-semibold text-rose-600" : "text-ink-muted"}`}>
                        Due {formatDate(r.due_date)}{overdue ? " · overdue" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-rose-600 tnum">
                        {inr(r.balance > 0 ? r.balance : r.total)}
                      </span>
                      <RecordPaymentDialog
                        tenants={payTenants}
                        month={month}
                        preselectId={r.tenant_id}
                        variant="collect"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
