import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Filterable } from "@/components/app/filterable";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AddExpenseDialog } from "@/components/admin/add-expense-dialog";
import { ExpenseCategoriesDialog } from "@/components/admin/expense-categories-dialog";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { deleteExpenseAction } from "@/lib/actions/admin";
import { requireRole } from "@/lib/guards";
import { expenseSummary, listExpenseCategories, listExpenses } from "@/lib/db";
import { currentMonth, formatDate, inr } from "@/lib/utils";

export const metadata: Metadata = { title: "Expenses" };

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y!, (mo ?? 1) - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

const CATEGORY_TONE: Record<string, "clay" | "teal" | "gold" | "rose" | "neutral"> = {
  rent: "clay",
  salaries: "teal",
  utilities: "gold",
  groceries: "teal",
  maintenance: "rose",
  supplies: "neutral",
  marketing: "clay",
  other: "neutral",
};

export default async function ExpensesPage() {
  await requireRole(["admin", "staff"]);
  const month = currentMonth();
  const [expenses, summary, categories] = await Promise.all([
    listExpenses(month),
    expenseSummary(month),
    listExpenseCategories(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const maxCat = summary.byCategory[0]?.amount ?? 1;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={monthLabel(month)}
        title="Expenses"
        subtitle="Log what your PG spends — it flows straight into your P&L."
        action={
          <div className="flex items-center gap-2">
            <ExpenseCategoriesDialog categories={categories} />
            <AddExpenseDialog defaultDate={today} categories={categories} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* summary */}
        <Card className="p-5 sm:p-6">
          <p className="text-sm font-medium text-ink-soft">Total this month</p>
          <p className="mt-1 font-display text-4xl font-semibold text-ink tnum">
            {inr(summary.total)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">{expenses.length} entries</p>

          <div className="mt-5 space-y-3">
            {summary.byCategory.length === 0 && (
              <p className="text-sm text-ink-muted">No expenses logged yet.</p>
            )}
            {summary.byCategory.map((c) => (
              <div key={c.category}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="capitalize text-ink-soft">{c.category}</span>
                  <span className="font-semibold text-ink tnum">{inr(c.amount)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-paper-2">
                  <div
                    className="h-full rounded-full bg-clay-400"
                    style={{ width: `${Math.round((c.amount / maxCat) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* list */}
        <Filterable className="lg:col-span-2" placeholder="Search by category or note…">
        <Card>
          <div className="border-b border-line p-5 sm:p-6">
            <h3 className="text-lg text-ink">All expenses · {monthLabel(month)}</h3>
          </div>
          {expenses.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Wallet}
                title="No expenses yet"
                body="Log your first expense to start tracking profit."
                action={<AddExpenseDialog defaultDate={today} categories={categories} />}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper-2/40 text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th className="px-6 py-3 font-semibold">Category</th>
                    <th className="px-6 py-3 font-semibold">Note</th>
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 text-right font-semibold">Amount</th>
                    <th className="px-6 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr
                      key={e.id}
                      data-search={`${e.category} ${e.description ?? ""}`}
                      className="border-b border-line last:border-0 hover:bg-paper-2/30"
                    >
                      <td className="px-6 py-3.5">
                        <Badge tone={CATEGORY_TONE[e.category] ?? "neutral"} className="capitalize">
                          {e.category}
                        </Badge>
                      </td>
                      <td className="px-6 py-3.5 text-ink-soft">{e.description ?? "—"}</td>
                      <td className="px-6 py-3.5 text-ink-muted tnum">{formatDate(e.date)}</td>
                      <td className="px-6 py-3.5 text-right font-semibold text-ink tnum">{inr(e.amount)}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <AddExpenseDialog defaultDate={today} expense={e} categories={categories} />
                          <ConfirmDelete action={deleteExpenseAction} id={e.id} title="Delete expense" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </Filterable>
      </div>
    </div>
  );
}
