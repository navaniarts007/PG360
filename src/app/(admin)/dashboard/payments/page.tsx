import type { Metadata } from "next";
import { CheckCircle2, Clock, IndianRupee, Paperclip } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { PaymentStatusPill } from "@/components/ui/status";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";
import { PaymentDetailsCard } from "@/components/admin/payment-details-card";
import { requireRole } from "@/lib/guards";
import { adminKpis, getMonthPayments, getPayTenants, getPgAccount } from "@/lib/db";
import { currentMonth, inr, inrCompact } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

const MODE: Record<string, string> = { upi: "UPI", cash: "Cash", bank: "Bank" };

export default async function PaymentsPage() {
  const me = await requireRole(["admin", "staff"]);
  const month = currentMonth();
  const [kpis, payTenants, all, pg] = await Promise.all([
    adminKpis(month),
    getPayTenants(),
    getMonthPayments(month),
    me.pg_id ? getPgAccount(me.pg_id) : Promise.resolve(null),
  ]);

  const order = { due: 0, partial: 1, paid: 2 } as const;
  const rows = [...all].sort((a, b) => order[a.status] - order[b.status]);
  const paidCount = rows.filter((r) => r.status === "paid").length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="June 2026"
        title="Payments"
        subtitle="Record rent and track who has paid vs who is due this month."
        action={<RecordPaymentDialog tenants={payTenants} month={month} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryStat icon={IndianRupee} accent="teal" label="Collected" value={inrCompact(kpis.collected)} sub={`of ${inrCompact(kpis.billed)} billed`} />
        <SummaryStat icon={Clock} accent="rose" label="Outstanding" value={inrCompact(kpis.due)} sub={`${rows.length - paidCount} tenants pending`} />
        <SummaryStat icon={CheckCircle2} accent="clay" label="Paid in full" value={`${paidCount}/${rows.length}`} sub="tenants this month" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-2/40 text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-6 py-3.5 font-semibold">Tenant</th>
                <th className="px-6 py-3.5 font-semibold">Billed</th>
                <th className="px-6 py-3.5 font-semibold">Paid</th>
                <th className="px-6 py-3.5 font-semibold">Balance</th>
                <th className="px-6 py-3.5 font-semibold">Mode</th>
                <th className="px-6 py-3.5 font-semibold">Status</th>
                <th className="px-6 py-3.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const balance = r.total_amount - r.amount_paid;
                return (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper-2/30">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-full bg-clay-50 text-[0.7rem] font-bold text-clay-600">
                          {r.room}
                        </span>
                        <span className="font-semibold text-ink">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-ink-soft tnum">{inr(r.total_amount)}</td>
                    <td className="px-6 py-3.5 text-ink-soft tnum">{inr(r.amount_paid)}</td>
                    <td className="px-6 py-3.5 tnum">
                      {balance > 0 ? (
                        <span className="font-semibold text-rose-600">{inr(balance)}</span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-ink-muted">
                      <span className="flex items-center gap-2">
                        {r.payment_mode ? MODE[r.payment_mode] : "—"}
                        {r.payment_screenshot_url && (
                          <a
                            href={r.payment_screenshot_url}
                            target="_blank"
                            rel="noreferrer"
                            title="View payment proof"
                            className="text-clay-600 hover:text-clay-700"
                          >
                            <Paperclip className="size-3.5" />
                          </a>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <PaymentStatusPill status={r.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {r.status !== "paid" ? (
                        <RecordPaymentDialog
                          tenants={payTenants}
                          month={month}
                          preselectId={r.tenant_id}
                          variant="collect"
                        />
                      ) : (
                        <span className="text-xs text-teal-600">✓ Settled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <PaymentDetailsCard
        upiId={pg?.upi_id ?? null}
        bankDetails={pg?.bank_details ?? null}
        qrUrl={pg?.payment_qr_url ?? null}
      />
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  accent,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  accent: "teal" | "rose" | "clay";
  label: string;
  value: string;
  sub: string;
}) {
  const tone = {
    teal: "bg-teal-50 text-teal-600 ring-teal-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
    clay: "bg-clay-50 text-clay-600 ring-clay-100",
  }[accent];
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <span className={`grid size-11 place-items-center rounded-xl ring-1 ring-inset ${tone}`}>
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold text-ink tnum">{value}</p>
        <p className="text-sm font-medium text-ink-soft">{label}</p>
        <p className="text-xs text-ink-muted">{sub}</p>
      </div>
    </div>
  );
}
