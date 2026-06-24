import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/guards";
import { getInvoiceWithPg } from "@/lib/db";
import { BILLING } from "@/lib/site";
import { rupeesInWords } from "@/lib/money";
import { formatDate, inr } from "@/lib/utils";
import { PrintButton } from "@/components/tenant/print-button";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["super_admin"]);
  const { id } = await params;
  const data = await getInvoiceWithPg(id);
  if (!data) notFound();
  const { invoice: iv, pg } = data;

  const tax = Math.round((iv.amount * iv.tax_percent) / 100);
  const total = iv.amount + tax;

  return (
    <div className="min-h-screen bg-paper-2 px-4 py-8 print:bg-white print:p-0">
      <style>{`@media print { .no-print { display: none !important; } @page { margin: 16mm; } }`}</style>

      <div className="mx-auto max-w-2xl">
        <div className="no-print mb-5 flex items-center justify-between">
          <a href={`/platform/accounts/${pg.id}`} className="text-sm font-semibold text-clay-600 hover:text-clay-700">
            ← Back to account
          </a>
          <PrintButton />
        </div>

        <div className="rounded-2xl border border-line bg-white p-8 shadow-soft print:border-0 print:shadow-none sm:p-10">
          {/* header */}
          <div className="flex items-start justify-between border-b border-line pb-5">
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">{BILLING.company}</h1>
              <p className="mt-0.5 text-sm text-ink-muted">{BILLING.tagline}</p>
              <p className="mt-2 text-xs text-ink-muted">{BILLING.address}</p>
              <p className="text-xs text-ink-muted">{BILLING.email} · {BILLING.phone}</p>
              {BILLING.gstin && <p className="text-xs text-ink-muted">GSTIN: {BILLING.gstin}</p>}
            </div>
            <div className="text-right">
              <p className="font-display text-xl font-semibold text-ink">INVOICE</p>
              <p className="mt-1 font-mono text-sm font-semibold text-ink">INV-{iv.number}</p>
              <p className="text-xs text-ink-muted">Issued {formatDate(iv.issue_date)}</p>
              {iv.due_date && <p className="text-xs text-ink-muted">Due {formatDate(iv.due_date)}</p>}
              <span
                className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  iv.status === "paid"
                    ? "bg-teal-50 text-teal-600 ring-1 ring-teal-100"
                    : "bg-gold-50 text-gold-600 ring-1 ring-gold-100"
                }`}
              >
                {iv.status === "paid" ? "PAID" : "UNPAID"}
              </span>
            </div>
          </div>

          {/* bill to */}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Billed to</p>
              <p className="mt-1 font-semibold text-ink">{pg.pg_name}</p>
              <p className="text-sm text-ink-soft">{pg.owner_name}</p>
              <p className="text-sm text-ink-muted">{pg.location}</p>
              <p className="text-sm text-ink-muted">{pg.mobile}</p>
            </div>
            {iv.period_label && (
              <div className="sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Billing period</p>
                <p className="mt-1 font-medium text-ink">{iv.period_label}</p>
              </div>
            )}
          </div>

          {/* line items */}
          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="py-2 font-semibold">Description</th>
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="py-3 text-ink">{iv.description}</td>
                <td className="py-3 text-right text-ink tnum">{inr(iv.amount)}</td>
              </tr>
              {iv.tax_percent > 0 && (
                <tr className="border-b border-line">
                  <td className="py-3 text-ink-soft">GST / tax ({iv.tax_percent}%)</td>
                  <td className="py-3 text-right text-ink-soft tnum">{inr(tax)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-4 flex items-end justify-between rounded-xl bg-paper-2/60 p-5">
            <div>
              <p className="text-sm text-ink-muted">Total payable</p>
              <p className="mt-0.5 text-sm text-ink-soft">{rupeesInWords(total)}</p>
            </div>
            <p className="font-display text-3xl font-semibold text-ink tnum">{inr(total)}</p>
          </div>

          {/* pay-to + notes */}
          {(BILLING.upi || BILLING.bank) && (
            <div className="mt-6 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Payment details</p>
              {BILLING.upi && <p className="mt-1 text-ink">UPI: {BILLING.upi}</p>}
              {BILLING.bank && <p className="text-ink">{BILLING.bank}</p>}
            </div>
          )}
          {iv.notes && <p className="mt-6 text-xs text-ink-muted">{iv.notes}</p>}

          <p className="mt-10 border-t border-line pt-4 text-center text-xs text-ink-muted">
            This is a computer-generated invoice from {BILLING.company}.
          </p>
        </div>
      </div>
    </div>
  );
}
