import type { Metadata } from "next";
import { CheckCircle2, Clock, ExternalLink, IndianRupee } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { PaymentStatusPill } from "@/components/ui/status";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";
import { PaymentDetailsCard } from "@/components/admin/payment-details-card";
import { VerifyPaymentButton } from "@/components/admin/verify-payment-button";
import { requireRole } from "@/lib/guards";
import { adminKpis, getMonthBill, getPayTenants, getPgAccount } from "@/lib/db";
import { getActiveProperty } from "@/lib/auth";
import { currentMonth, inr, inrCompact } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

const MODE: Record<string, string> = { upi: "UPI", cash: "Cash", bank: "Bank" };

export default async function PaymentsPage() {
  await requireRole(["admin", "staff"]);
  const month = currentMonth();
  const pid = await getActiveProperty();
  const [kpis, payTenants, rows, pg] = await Promise.all([
    adminKpis(month),
    getPayTenants(),
    getMonthBill(month),
    pid ? getPgAccount(pid) : Promise.resolve(null),
  ]);

  const paidCount = rows.filter((r) => r.status === "paid").length;
  const pendingVerify = rows.filter((r) => r.paymentId && !r.verified && r.paid > 0).length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`${new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`}
        title="Payments"
        subtitle="Every active tenant's bill for the month — collect dues and verify tenant-submitted payments."
        action={<RecordPaymentDialog tenants={payTenants} month={month} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryStat icon={IndianRupee} accent="teal" label="Collected" value={inrCompact(kpis.collected)} sub={`of ${inrCompact(kpis.billed)} billed`} />
        <SummaryStat icon={Clock} accent="rose" label="Outstanding" value={inrCompact(kpis.due)} sub={`${rows.length - paidCount} tenants pending`} />
        <SummaryStat icon={CheckCircle2} accent="gold" label="To verify" value={String(pendingVerify)} sub="tenant-submitted payments" />
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
                <th className="px-6 py-3.5 font-semibold">Status</th>
                <th className="px-6 py-3.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const unverified = !!r.paymentId && !r.verified && r.paid > 0;
                return (
                  <tr key={r.tenant_id} className="border-b border-line last:border-0 hover:bg-paper-2/30">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-full bg-clay-50 text-[0.7rem] font-bold text-clay-600">
                          {r.room}
                        </span>
                        <span className="font-semibold text-ink">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-ink-soft tnum">{inr(r.total)}</td>
                    <td className="px-6 py-3.5 text-ink-soft tnum">{inr(r.paid)}</td>
                    <td className="px-6 py-3.5 tnum">
                      {r.balance > 0 ? (
                        <span className="font-semibold text-rose-600">{inr(r.balance)}</span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <PaymentStatusPill status={r.status} />
                        {unverified && (
                          <span className="rounded-full bg-gold-50 px-2 py-0.5 text-[0.7rem] font-semibold text-gold-600 ring-1 ring-gold-100">
                            unverified
                          </span>
                        )}
                        {r.payment_mode && (
                          <span className="text-xs text-ink-muted">{MODE[r.payment_mode]}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {r.screenshot_url && (
                          <a
                            href={r.screenshot_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View payment screenshot"
                            className="grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-paper-2 hover:text-clay-600"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        )}
                        {unverified && <VerifyPaymentButton paymentId={r.paymentId!} />}
                        {r.balance > 0 ? (
                          <RecordPaymentDialog
                            tenants={payTenants}
                            month={month}
                            preselectId={r.tenant_id}
                            variant="collect"
                          />
                        ) : r.verified ? (
                          <span className="text-xs text-teal-600">✓ Verified</span>
                        ) : null}
                      </div>
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
  accent: "teal" | "rose" | "gold";
  label: string;
  value: string;
  sub: string;
}) {
  const tone = {
    teal: "bg-teal-50 text-teal-600 ring-teal-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
    gold: "bg-gold-50 text-gold-600 ring-gold-100",
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
