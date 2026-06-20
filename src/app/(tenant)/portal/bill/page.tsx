import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  CalendarClock,
  ExternalLink,
  Home,
  Plus,
  Receipt,
  Utensils,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PaymentStatusPill } from "@/components/ui/status";
import { TenantRecordPaymentDialog } from "@/components/tenant/record-payment-dialog";
import { UpiPay } from "@/components/tenant/upi-pay";
import { requireRole } from "@/lib/guards";
import { getMyPayments, getMyPg, getMyTenant } from "@/lib/db";
import { computeBill } from "@/lib/money";
import { currentMonth, formatDate, inr } from "@/lib/utils";

export const metadata: Metadata = { title: "My Bill" };

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y!, (mo ?? 1) - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export default async function MyBill() {
  await requireRole(["tenant"]);
  const mine = await getMyTenant();
  if (!mine) notFound();
  const tenant = mine.tenant;
  const room = mine.room;

  const [payments, pg] = await Promise.all([getMyPayments(), getMyPg()]);
  const month = currentMonth();
  const current = payments.find((p) => p.month_for === month);
  const history = payments.filter((p) => p.month_for !== month);

  // Invoice is auto-derived the Bangalore way when the owner hasn't recorded one
  // yet: pro-rata first month + food included by default (opt-out deducts).
  const derived = computeBill({
    pricePerMonth: tenant.rent_amount ?? 0,
    checkinISO: tenant.checkin_date,
    month,
    foodOptOut: tenant.food_opt_out,
    foodOptOutDeduction: pg?.food_opt_out_deduction ?? 0,
  });
  const baseRent = current?.base_rent ?? derived.baseRent;
  const electricity = current?.electricity_charge ?? 0;
  const food = current?.food_charge ?? 0;
  const foodDeduction = current?.food_opt_out_deduction ?? derived.foodDeduction;
  const other = current?.other_charges ?? 0;
  const total = current?.total_amount ?? derived.total;
  const isProRata = current?.is_pro_rata ?? derived.isProRata;
  const proRataDays = current?.pro_rata_days ?? derived.proRataDays;
  const paid = current?.amount_paid ?? 0;
  const balance = Math.max(total - paid, 0);
  const paidPct = total > 0 ? Math.min(Math.round((paid / total) * 100), 100) : 0;
  const status = current?.status ?? (total > 0 ? "due" : "due");
  const hasPayInfo = !!(pg?.upi_id || pg?.bank_details || pg?.payment_qr_url);

  // deadline = rent due day of this month
  const dueDate = `${month}-${String(tenant.rent_due_day).padStart(2, "0")}`;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = balance > 0 && today > dueDate;

  const noBed = !room && !current;
  const pendingVerify = !!current && !current.verified && paid > 0;

  const lines: { icon: typeof Home; label: string; value: number }[] = [
    {
      icon: Home,
      label: isProRata ? `Base rent (pro-rata · ${proRataDays} days)` : "Base rent",
      value: baseRent,
    },
    { icon: Zap, label: "Electricity", value: electricity },
    { icon: Utensils, label: "Food", value: food },
    { icon: Plus, label: "Other charges", value: other },
  ].filter((l) => l.value > 0 || l.label.startsWith("Base rent"));
  if (foodDeduction > 0) {
    lines.push({ icon: Utensils, label: "Food opt-out credit", value: -foodDeduction });
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-clay-500">
          Billing
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-[2.1rem]">
          My bill
        </h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
                <Receipt className="size-5" />
              </span>
              <div>
                <h3 className="text-lg text-ink">{monthLabel(month)}</h3>
                <p className="text-xs text-ink-muted">Invoice · {tenant.name}</p>
              </div>
            </div>
            <PaymentStatusPill status={status} />
          </div>

          <div className="p-5 sm:p-6">
            {noBed ? (
              <div className="rounded-xl border border-line bg-paper-2/40 p-6 text-center">
                <p className="font-semibold text-ink">No bed assigned yet</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Your PG owner hasn&apos;t assigned you a bed, so there&apos;s no rent to show
                  yet. Please contact them.
                </p>
              </div>
            ) : (
              <>
            {/* deadline */}
            {pendingVerify && (
              <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-600">
                <CalendarClock className="size-4 shrink-0" />
                <span className="font-medium">
                  Payment submitted — awaiting your owner&apos;s confirmation.
                </span>
              </div>
            )}
            <div
              className={`mb-4 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${
                overdue
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : balance > 0
                    ? "border-gold-200 bg-gold-50 text-gold-600"
                    : "border-teal-200 bg-teal-50 text-teal-700"
              }`}
            >
              <CalendarClock className="size-4 shrink-0" />
              {balance === 0 ? (
                <span className="font-medium">Paid in full — nothing due.</span>
              ) : overdue ? (
                <span className="font-medium">
                  Overdue — was due {formatDate(dueDate)}. Please pay {inr(balance)} now.
                </span>
              ) : (
                <span className="font-medium">
                  Pay {inr(balance)} before {formatDate(dueDate)}.
                </span>
              )}
            </div>

            <div className="space-y-1">
              {lines.map((l) => (
                <div key={l.label} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2.5 text-ink-soft">
                    <l.icon className="size-4 text-ink-muted" /> {l.label}
                  </span>
                  <span className="font-medium text-ink tnum">{inr(l.value)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-4">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-display text-2xl font-semibold text-ink tnum">{inr(total)}</span>
            </div>
            {!current && (
              <p className="mt-1 text-xs text-ink-muted">
                Estimated from your rent. Electricity / food (if any) are added by your owner.
              </p>
            )}

            {/* progress */}
            <div className="mt-4 rounded-xl border border-line bg-paper-2/40 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">
                  Paid <span className="font-semibold text-teal-600 tnum">{inr(paid)}</span> of{" "}
                  <span className="tnum">{inr(total)}</span>
                </span>
                <span className="text-xs font-semibold text-ink-muted tnum">{paidPct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-2">
                <div
                  className={`h-full rounded-full ${balance > 0 ? "bg-gold-400" : "bg-teal-500"}`}
                  style={{ width: `${paidPct}%` }}
                />
              </div>
              {balance > 0 ? (
                <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
                  <div>
                    <p className="text-xs text-ink-muted">Amount to pay now</p>
                    <p className="text-[0.7rem] text-ink-muted">
                      {status === "partial"
                        ? "Part-paid — please clear the balance"
                        : "Minimum to clear this month's bill"}
                    </p>
                  </div>
                  <p className="font-display text-3xl font-semibold text-rose-600 tnum">{inr(balance)}</p>
                </div>
              ) : (
                <p className="mt-3 border-t border-line pt-3 text-sm font-semibold text-teal-600">
                  ✓ Fully paid — thank you!
                </p>
              )}
            </div>

            {/* how to pay — always visible once the owner has set their details */}
            {hasPayInfo && (
              <div className="mt-4 rounded-xl border border-line bg-surface p-4">
                <p className="text-sm font-semibold text-ink">
                  {balance > 0 ? `How to pay ${inr(balance)}` : "Payment details"}
                </p>

                {/* one-tap direct UPI when there's something due */}
                {pg?.upi_id && balance > 0 && (
                  <div className="mt-3 rounded-xl border border-clay-100 bg-clay-50/50 p-3">
                    <UpiPay
                      vpa={pg.upi_id}
                      payeeName={pg.owner_name || pg.pg_name || "PG"}
                      amount={balance}
                      note={`Rent ${monthLabel(month)}`}
                    />
                  </div>
                )}

                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
                  {pg?.payment_qr_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pg.payment_qr_url}
                      alt="Payment QR"
                      className="size-32 shrink-0 rounded-xl border border-line bg-white object-contain p-1"
                    />
                  )}
                  <div className="space-y-2 text-sm">
                    {pg?.upi_id && (
                      <div>
                        <span className="text-xs text-ink-muted">UPI ID</span>
                        <p className="font-mono font-semibold text-ink">{pg.upi_id}</p>
                      </div>
                    )}
                    {pg?.bank_details && (
                      <div>
                        <span className="text-xs text-ink-muted">Bank transfer</span>
                        <p className="whitespace-pre-line text-ink-soft">{pg.bank_details}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* record a payment — when something is still due */}
            {balance > 0 && (
              <div className="mt-4">
                {!hasPayInfo && (
                  <p className="mb-2 text-xs text-ink-muted">
                    Pay your PG owner by UPI, cash or bank transfer, then record it below.
                  </p>
                )}
                <TenantRecordPaymentDialog month={month} balance={balance} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4">
              {current?.payment_screenshot_url && (
                <a
                  href={current.payment_screenshot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-clay-600 hover:text-clay-700"
                >
                  <ExternalLink className="size-4" /> View your uploaded payment proof
                </a>
              )}
              {current && current.amount_paid > 0 && (
                <a
                  href={`/receipt/${current.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-clay-600 hover:text-clay-700"
                >
                  <Receipt className="size-4" /> Download HRA receipt
                </a>
              )}
            </div>
              </>
            )}
          </div>
        </Card>

        {/* History */}
        <Card>
          <div className="border-b border-line p-5 sm:p-6">
            <h3 className="text-lg text-ink">Payment history</h3>
          </div>
          {history.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">No earlier payments yet.</p>
          ) : (
            <div className="divide-y divide-line">
              {history.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                  <div>
                    <p className="text-sm font-semibold text-ink">{monthLabel(p.month_for)}</p>
                    <p className="text-xs text-ink-muted tnum">{inr(p.amount_paid)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.amount_paid > 0 && (
                      <a
                        href={`/receipt/${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download HRA rent receipt"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-clay-600 hover:text-clay-700"
                      >
                        <Receipt className="size-3.5" /> Receipt
                      </a>
                    )}
                    <PaymentStatusPill status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
