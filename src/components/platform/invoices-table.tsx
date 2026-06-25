"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toggleInvoicePaidAction } from "@/lib/actions/platform";
import { formatDate, inr } from "@/lib/utils";
import type { PlatformInvoice } from "@/lib/types";

type Row = PlatformInvoice & { pg_name: string };

const CYCLE: Record<string, string> = {
  one_time: "One-time",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function InvoicesTable({ invoices }: { invoices: Row[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "unpaid" | "paid">("all");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return invoices.filter((iv) => {
      if (status !== "all" && iv.status !== status) return false;
      if (!term) return true;
      return (
        iv.pg_name.toLowerCase().includes(term) ||
        String(iv.number).includes(term) ||
        iv.description.toLowerCase().includes(term)
      );
    });
  }, [invoices, q, status]);

  const total = (iv: Row) => iv.amount + Math.round((iv.amount * iv.tax_percent) / 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by PG, invoice no. or description…"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-ink outline-none focus:border-clay-400"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "unpaid", "paid"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                status === s ? "bg-clay-600 text-white" : "border border-line bg-surface text-ink-soft hover:text-clay-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-2/40 text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-6 py-3.5 font-semibold">Invoice</th>
                <th className="px-6 py-3.5 font-semibold">PG</th>
                <th className="px-6 py-3.5 font-semibold">Cycle</th>
                <th className="px-6 py-3.5 font-semibold">Issued</th>
                <th className="px-6 py-3.5 font-semibold">Amount</th>
                <th className="px-6 py-3.5 font-semibold">Status</th>
                <th className="px-6 py-3.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-ink-muted">
                    No invoices match.
                  </td>
                </tr>
              ) : (
                rows.map((iv) => (
                  <tr key={iv.id} className="border-b border-line last:border-0 hover:bg-paper-2/30">
                    <td className="px-6 py-3.5">
                      <p className="font-semibold text-ink">INV-{iv.number}</p>
                      <p className="text-xs text-ink-muted">{iv.description}</p>
                    </td>
                    <td className="px-6 py-3.5 text-ink-soft">
                      <Link href={`/platform/accounts/${iv.pg_id}`} className="hover:text-clay-600">
                        {iv.pg_name}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 text-ink-soft">{CYCLE[iv.billing_cycle]}</td>
                    <td className="px-6 py-3.5 text-ink-muted tnum">{formatDate(iv.issue_date)}</td>
                    <td className="px-6 py-3.5 font-semibold text-ink tnum">{inr(total(iv))}</td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          iv.status === "paid"
                            ? "bg-teal-50 text-teal-600 ring-1 ring-teal-100"
                            : "bg-gold-50 text-gold-600 ring-1 ring-gold-100"
                        }`}
                      >
                        {iv.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/invoice/${iv.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-clay-50 px-3 py-1.5 text-xs font-semibold text-clay-700 hover:bg-clay-100"
                        >
                          <FileText className="size-3.5" /> Print
                        </Link>
                        <form action={toggleInvoicePaidAction}>
                          <input type="hidden" name="id" value={iv.id} />
                          <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-clay-600">
                            {iv.status === "paid" ? "Mark unpaid" : "Mark paid"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
