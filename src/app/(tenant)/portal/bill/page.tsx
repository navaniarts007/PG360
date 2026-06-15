import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Receipt, Zap, Utensils, Home, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PaymentStatusPill } from "@/components/ui/status";
import { requireRole } from "@/lib/guards";
import { getMyPayments, getMyTenant } from "@/lib/db";
import { currentMonth, inr } from "@/lib/utils";

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

  const payments = await getMyPayments();
  const current = payments.find((p) => p.month_for === currentMonth());
  const history = payments.filter((p) => p.month_for !== currentMonth());
  const balance = current ? current.total_amount - current.amount_paid : 0;

  const lines = current
    ? [
        { icon: Home, label: "Base rent", value: current.base_rent },
        { icon: Zap, label: "Electricity", value: current.electricity_charge },
        { icon: Utensils, label: "Food", value: current.food_charge },
        { icon: Plus, label: "Other charges", value: current.other_charges },
      ].filter((l) => l.value > 0 || l.label === "Base rent")
    : [];

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
        {/* Current invoice */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
                <Receipt className="size-5" />
              </span>
              <div>
                <h3 className="text-lg text-ink">{monthLabel(currentMonth())}</h3>
                <p className="text-xs text-ink-muted">Invoice · {tenant.name}</p>
              </div>
            </div>
            {current ? (
              <PaymentStatusPill status={current.status} />
            ) : (
              <span className="text-sm text-ink-muted">Not billed yet</span>
            )}
          </div>

          {current ? (
            <div className="p-5 sm:p-6">
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
                <span className="font-display text-2xl font-semibold text-ink tnum">
                  {inr(current.total_amount)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-line bg-paper-2/40 p-4">
                  <p className="text-xs text-ink-muted">Paid</p>
                  <p className="mt-0.5 text-lg font-semibold text-teal-600 tnum">{inr(current.amount_paid)}</p>
                </div>
                <div className="rounded-xl border border-line bg-paper-2/40 p-4">
                  <p className="text-xs text-ink-muted">Outstanding</p>
                  <p className={`mt-0.5 text-lg font-semibold tnum ${balance > 0 ? "text-rose-600" : "text-teal-600"}`}>
                    {inr(balance)}
                  </p>
                </div>
              </div>

              {balance > 0 && (
                <div className="mt-4 rounded-xl bg-ink p-4 text-paper">
                  <p className="text-sm font-semibold">Pay {inr(balance)} to your PG owner</p>
                  <p className="mt-0.5 text-xs text-paper/60">
                    Cash, UPI or bank transfer. Your owner will mark it paid once received.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="p-6 text-sm text-ink-muted">
              Your invoice for this month hasn&apos;t been generated yet.
            </p>
          )}
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
                <div key={p.id} className="flex items-center justify-between px-5 py-3.5 sm:px-6">
                  <div>
                    <p className="text-sm font-semibold text-ink">{monthLabel(p.month_for)}</p>
                    <p className="text-xs text-ink-muted tnum">{inr(p.amount_paid)}</p>
                  </div>
                  <PaymentStatusPill status={p.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
