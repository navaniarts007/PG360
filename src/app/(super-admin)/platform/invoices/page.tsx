import type { Metadata } from "next";
import { IndianRupee, Clock, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { InvoicesTable } from "@/components/platform/invoices-table";
import { requireRole } from "@/lib/guards";
import { listAllInvoices } from "@/lib/db";
import { inrCompact } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  await requireRole(["super_admin"]);
  const invoices = await listAllInvoices();

  const total = (iv: (typeof invoices)[number]) =>
    iv.amount + Math.round((iv.amount * iv.tax_percent) / 100);
  const billed = invoices.reduce((s, iv) => s + total(iv), 0);
  const collected = invoices.filter((iv) => iv.status === "paid").reduce((s, iv) => s + total(iv), 0);
  const outstanding = billed - collected;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Super admin"
        title="Invoices"
        subtitle="Every subscription invoice across the platform. Generate new ones from a PG account."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total billed" value={inrCompact(billed)} icon={IndianRupee} accent="clay" hint={`${invoices.length} invoices`} />
        <StatCard label="Collected" value={inrCompact(collected)} icon={CheckCircle2} accent="teal" hint="paid invoices" />
        <StatCard label="Outstanding" value={inrCompact(outstanding)} icon={Clock} accent="rose" hint="awaiting payment" />
      </div>

      <InvoicesTable invoices={invoices} />
    </div>
  );
}
