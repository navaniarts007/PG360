import type { Metadata } from "next";
import {
  BedDouble,
  Download,
  IndianRupee,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { PnlChart } from "@/components/admin/pnl-chart";
import { requireRole } from "@/lib/guards";
import { adminKpis, expenseSummary, pnl } from "@/lib/db";
import { currentMonth, inr } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y!, (mo ?? 1) - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

const REPORTS = [
  { type: "pnl", label: "P&L summary" },
  { type: "rent", label: "Rent collection" },
  { type: "expenses", label: "Expenses" },
  { type: "occupancy", label: "Occupancy" },
];

export default async function ReportsPage() {
  await requireRole(["admin", "staff"]);
  const month = currentMonth();
  const [p, kpis, expenses] = await Promise.all([
    pnl(month),
    adminKpis(month),
    expenseSummary(month),
  ]);
  const collectionRate = p.billed ? Math.round((p.collected / p.billed) * 100) : 0;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={monthLabel(month)}
        title="Reports & P&L"
        subtitle="Your month at a glance — and one click to export any of it."
      />

      {/* P&L headline */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Rent billed" value={inr(p.billed)} icon={IndianRupee} tone="clay" />
        <Metric label="Collected" value={inr(p.collected)} icon={TrendingUp} tone="teal" hint={`${collectionRate}% collection rate`} />
        <Metric label="Expenses" value={inr(p.expenses)} icon={Wallet} tone="rose" />
        <Metric
          label="Net profit"
          value={inr(p.net)}
          icon={p.net >= 0 ? TrendingUp : TrendingDown}
          tone={p.net >= 0 ? "gold" : "rose"}
          hint="collected − expenses"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* chart */}
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <h3 className="text-lg text-ink">P&L · {monthLabel(month)}</h3>
          <p className="mt-0.5 text-sm text-ink-muted">Billed vs collected vs spent.</p>
          <div className="mt-4">
            <PnlChart billed={p.billed} collected={p.collected} expenses={p.expenses} net={p.net} />
          </div>
        </Card>

        {/* occupancy + expense mix */}
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 text-ink-soft">
              <BedDouble className="size-4" />
              <h3 className="text-base font-semibold">Occupancy</h3>
            </div>
            <p className="mt-2 font-display text-3xl font-semibold text-ink tnum">
              {kpis.occupancyPct}%
            </p>
            <p className="text-xs text-ink-muted">{kpis.occupiedBeds}/{kpis.totalBeds} beds filled</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-2">
              <div className="h-full rounded-full bg-teal-500" style={{ width: `${kpis.occupancyPct}%` }} />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h3 className="text-base font-semibold text-ink-soft">Top expense categories</h3>
            <div className="mt-3 space-y-2">
              {expenses.byCategory.slice(0, 4).map((c) => (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-ink-soft">{c.category}</span>
                  <span className="font-semibold text-ink tnum">{inr(c.amount)}</span>
                </div>
              ))}
              {expenses.byCategory.length === 0 && (
                <p className="text-sm text-ink-muted">No expenses yet this month.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* exports */}
      <Card className="p-5 sm:p-6">
        <h3 className="text-lg text-ink">Export to CSV</h3>
        <p className="mt-0.5 text-sm text-ink-muted">Download any report for {monthLabel(month)}.</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {REPORTS.map((r) => (
            <a
              key={r.type}
              href={`/api/reports?type=${r.type}&month=${month}`}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink-soft shadow-soft transition-all hover:-translate-y-0.5 hover:text-clay-600 hover:shadow-lift"
            >
              <Download className="size-4" /> {r.label}
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  tone: "clay" | "teal" | "rose" | "gold";
}) {
  const t = {
    clay: "bg-clay-50 text-clay-600 ring-clay-100",
    teal: "bg-teal-50 text-teal-600 ring-teal-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
    gold: "bg-gold-50 text-gold-600 ring-gold-100",
  }[tone];
  return (
    <Card className="p-5">
      <span className={`grid size-10 place-items-center rounded-xl ring-1 ring-inset ${t}`}>
        <Icon className="size-5" />
      </span>
      <p className="mt-4 text-2xl font-semibold text-ink tnum">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-ink-soft">{label}</p>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </Card>
  );
}
