import type { Metadata } from "next";
import { CheckCircle2, Clock, ExternalLink, IndianRupee } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Filterable } from "@/components/app/filterable";
import { Card } from "@/components/ui/card";
import { PaymentStatusPill } from "@/components/ui/status";
import { VerifyRejectButtons } from "@/components/admin/verify-reject-buttons";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";
import { requireRole } from "@/lib/guards";
import { adminKpis, getMonthBill, getPayTenants, pendingFirstMonthPartials } from "@/lib/db";
import { currentMonthRent } from "@/lib/rent";
import { currentMonth, formatDate, inr, inrCompact } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

const MODE: Record<string, string> = { upi: "UPI", cash: "Cash", bank: "Bank" };

export default async function PaymentsPage() {
  await requireRole(["admin", "staff"]);
  const month = currentMonth();
  const [kpis, rows, payTenants, earlyDues] = await Promise.all([
    adminKpis(month),
    getMonthBill(month),
    getPayTenants(),
    pendingFirstMonthPartials(month),
  ]);

  const paidCount = rows.filter((r) => r.status === "paid").length;
  const pendingVerify = rows.filter((r) => r.paymentId && !r.verified && r.paid > 0).length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        title="Payments"
        subtitle="Every tenant's bill this month. Record a payment, or verify what tenants submit."
        action={<RecordPaymentDialog tenants={payTenants} month={month} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryStat icon={IndianRupee} accent="teal" label="Collected" value={inrCompact(kpis.collected)} sub={`of ${inrCompact(kpis.billed)} billed`} />
        <SummaryStat icon={Clock} accent="rose" label="Outstanding" value={inrCompact(kpis.due)} sub={`${rows.length - paidCount} tenants pending`} />
        <SummaryStat icon={CheckCircle2} accent="gold" label="To verify" value={String(pendingVerify)} sub="tenant-submitted payments" />
      </div>

      {/* uncollected first-month partials from earlier months (rolled off this month's bill) */}
      {earlyDues.length > 0 && (
        <Card className="overflow-hidden border-clay-200">
          <div className="flex items-center gap-2 border-b border-clay-100 bg-clay-50/50 px-6 py-3">
            <Clock className="size-4 text-clay-600" />
            <h3 className="text-sm font-semibold text-clay-800">
              Earlier dues · {earlyDues.length} first-month partial{earlyDues.length === 1 ? "" : "s"} not yet collected
            </h3>
          </div>
          <div className="divide-y divide-line">
            {earlyDues.map((e) => (
              <div key={e.tenant_id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-full bg-clay-50 text-[0.7rem] font-bold text-clay-600">
                    {e.room}
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{e.name}</p>
                    <p className="text-xs text-ink-muted">
                      1st month ({e.month_for}) · {e.days} day{e.days === 1 ? "" : "s"} from {formatDate(e.checkin_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="font-semibold text-ink tnum"
                    title={
                      `rent ${inr(e.rent)}` +
                      (e.deposit ? ` + deposit ${inr(e.deposit)}` : "") +
                      ` = ${inr(e.amount)}`
                    }
                  >
                    {inr(e.amount)}
                  </span>
                  <RecordPaymentDialog
                    tenants={payTenants}
                    month={e.month_for}
                    preselectId={e.tenant_id}
                    variant="collect"
                    prefill={{ baseRent: e.rent, days: e.days, deposit: e.deposit }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Filterable
        placeholder="Search by tenant or room…"
        filters={[
          {
            key: "pstatus",
            label: "Status",
            options: [
              { label: "All", value: "" },
              { label: "Paid", value: "paid" },
              { label: "Pending", value: "pending" },
              { label: "To verify", value: "awaiting" },
            ],
          },
        ]}
      >
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
                const pstatus = awaiting ? "awaiting" : r.status === "paid" ? "paid" : "pending";
                const cr = currentMonthRent(r, { securityDeposit: r.security_deposit });
                // show the first-month total only when nothing's been recorded yet
                const showProRata = cr.proRata && !r.paymentId;
                const tip = showProRata
                  ? `1st month = rent ${inr(cr.rent)}` +
                    (cr.deposit ? ` + deposit ${inr(cr.deposit)}` : "") +
                    ` = ${inr(cr.amount)}. Full rent ${inr(r.rent_amount)} from next month.`
                  : undefined;
                return (
                  <tr
                    key={r.tenant_id}
                    data-search={`${r.name} room ${r.room}`}
                    data-pstatus={pstatus}
                    className="border-b border-line last:border-0 hover:bg-paper-2/30"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-full bg-clay-50 text-[0.7rem] font-bold text-clay-600">
                          {r.room}
                        </span>
                        <span className="font-semibold text-ink">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 tnum">
                      {(() => {
                        return (
                          <span className="flex flex-col">
                            <span className="flex items-center gap-1.5">
                              <span className="text-ink-soft" title={tip}>{inr(showProRata ? cr.amount : r.total)}</span>
                              {showProRata && (
                                <span
                                  className="rounded-full bg-clay-50 px-1.5 py-0.5 text-[0.65rem] font-semibold text-clay-700 ring-1 ring-clay-100"
                                  title={tip}
                                >
                                  1st mo
                                </span>
                              )}
                            </span>
                            {showProRata && cr.deposit > 0 && (
                              <span className="text-[0.7rem] text-ink-muted">to collect · incl. deposit</span>
                            )}
                          </span>
                        );
                      })()}
                    </td>
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
                          <RecordPaymentDialog
                            tenants={payTenants}
                            month={month}
                            preselectId={r.tenant_id}
                            variant="collect"
                            // this table is month-scoped: always bill the current
                            // month (pro-rata for a current first month, else full)
                            prefill={
                              showProRata
                                ? { baseRent: cr.rent, days: cr.days, deposit: cr.deposit }
                                : { baseRent: r.rent_amount, days: 30, deposit: 0 }
                            }
                          />
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
      </Filterable>
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
