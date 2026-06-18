import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/guards";
import { getMyPayment, getMyPg, getMyTenant } from "@/lib/db";
import { rupeesInWords } from "@/lib/money";
import { formatDate, inr } from "@/lib/utils";
import { PrintButton } from "@/components/tenant/print-button";

export const metadata: Metadata = { title: "Rent Receipt" };

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y!, (mo ?? 1) - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export default async function RentReceipt({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  await requireRole(["tenant"]);
  const { paymentId } = await params;
  const [payment, mine, pg] = await Promise.all([
    getMyPayment(paymentId),
    getMyTenant(),
    getMyPg(),
  ]);
  if (!payment || !mine || payment.amount_paid <= 0) notFound();
  const tenant = mine.tenant;

  const receiptNo = `RCT-${payment.month_for.slice(0, 4)}-${paymentId.slice(0, 6).toUpperCase()}`;
  const amount = payment.amount_paid;

  return (
    <div className="min-h-screen bg-paper-2 px-4 py-8 print:bg-white print:p-0">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 16mm; } }`}</style>

      <div className="mx-auto max-w-2xl">
        {/* toolbar (hidden on print) */}
        <div className="no-print mb-5 flex items-center justify-between">
          <a href="/portal/bill" className="text-sm font-semibold text-clay-600 hover:text-clay-700">
            ← Back to my bill
          </a>
          <PrintButton />
        </div>

        <div className="rounded-2xl border border-line bg-white p-8 shadow-soft print:border-0 print:shadow-none sm:p-10">
          <div className="flex items-start justify-between border-b border-line pb-5">
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">Rent Receipt</h1>
              <p className="mt-1 text-sm text-ink-muted">For HRA / income-tax purposes</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-mono font-semibold text-ink">{receiptNo}</p>
              <p className="text-ink-muted">{formatDate(new Date().toISOString().slice(0, 10))}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Field label="Received from">{tenant.name}</Field>
            <Field label="For the month of">{monthLabel(payment.month_for)}</Field>
            <Field label="Landlord / Owner">{pg?.owner_name ?? "—"}</Field>
            <Field label="Owner PAN">
              {pg?.owner_pan || <span className="text-rose-600">Not provided</span>}
            </Field>
            <Field label="Property" className="sm:col-span-2">
              {pg?.pg_name}
              {pg?.property_address ? `, ${pg.property_address}` : ""}
            </Field>
          </div>

          <div className="mt-6 rounded-xl bg-paper-2/60 p-5 print:bg-paper-2/60">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-ink-muted">Amount received</p>
                <p className="mt-0.5 text-sm text-ink-soft">{rupeesInWords(amount)}</p>
              </div>
              <p className="font-display text-3xl font-semibold text-ink tnum">{inr(amount)}</p>
            </div>
          </div>

          <div className="mt-10 flex items-end justify-between">
            <p className="max-w-xs text-xs text-ink-muted">
              This receipt confirms the rent paid for the month stated above and may be
              used to claim House Rent Allowance (HRA).
            </p>
            <div className="text-center">
              <div className="h-12 w-40 border-b border-ink/40" />
              <p className="mt-1 text-xs text-ink-muted">Signature of landlord</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 font-medium text-ink">{children}</p>
    </div>
  );
}
