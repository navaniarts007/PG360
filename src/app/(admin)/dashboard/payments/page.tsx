import type { Metadata } from "next";
import { CheckCircle2, Clock, ExternalLink, IndianRupee } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { PaymentStatusPill } from "@/components/ui/status";
import { VerifyRejectButtons } from "@/components/admin/verify-reject-buttons";
import { requireRole } from "@/lib/guards";
import { adminKpis, getMonthBill } from "@/lib/db";
import { currentMonth, inr, inrCompact } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

const MODE: Record<string, string> = { upi: "UPI", cash: "Cash", bank: "Bank" };

export default async function PaymentsPage() {
  await requireRole(["admin", "staff"]);
  const month = currentMonth();
  const [kpis, rows] = await Promise.all([adminKpis(month), getMonthBill(month)]);

  const paidCount = rows.filter((r) => r.status === "paid").length;
  const pendingVerify = rows.filter((r) => r.paymentId && !r.verified && r.paid > 0).length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        title="Payments"
        subtitle="Every tenant's bill this month. Verify or reject what tenants submit."
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
                <th className="px-6 py-3.5 font-semibold">Monthly rent</th>
                <th className="px-6 py-3.5 font-semibold">Paid this month</th>
                <th className="px-6 py-3.5 font-semibold">Status</th>
                <th className="px-6 py-3.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const awaiting = !!r.paymentId && !r.verified && r.paid > 0;
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
                    <td className="px-6 py-3.5 tnum">
                      {r.paid > 0 ? (
                        <span className="font-semibold text-ink">{inr(r.paid)}</span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                      {r.payment_mode && (
                        <span className="ml-2 text-xs text-ink-muted">{MODE[r.payment_mode]}</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {r.paid <= 0 ? (
                        <span className="inline-flex rounded-full bg-paper-2 px-2.5 py-0.5 text-xs font-semibold text-ink-muted ring-1 ring-line">
                          Unpaid
                        </span>
                      ) : awaiting ? (
                        <span className="inline-flex rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-semibold text-gold-600 ring-1 ring-gold-100">
                          Awaiting review
                        </span>
                      ) : (
                        <PaymentStatusPill status={r.status} />
                      )}
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
                        {awaiting ? (
                          <VerifyRejectButtons paymentId={r.paymentId!} />
                        ) : r.paid > 0 && r.verified ? (
                          <span className="text-xs font-semibold text-teal-600">✓ Verified</span>
                        ) : (
                          <span className="text-xs text-ink-muted">Pending payment</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
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
