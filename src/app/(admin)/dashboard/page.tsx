import Link from "next/link";
import type { Metadata } from "next";
import {
  Archive,
  ArrowUpRight,
  BedDouble,
  CreditCard,
  IndianRupee,
  MessagesSquare,
  TrendingDown,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IssueStatusPill } from "@/components/ui/status";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";
import { GvmHome } from "@/components/admin/gvm-home";
import { requireRole } from "@/lib/guards";
import { getEdition } from "@/lib/get-client";
import {
  adminKpis,
  getMonthBill,
  getPayTenants,
  listIssuesWithTenant,
} from "@/lib/db";
import { currentMonth, formatDate, inr, inrCompact } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const QUICK_ACTIONS = [
  { href: "/dashboard/tenants", label: "Tenants", icon: Users },
  { href: "/dashboard/tenants", label: "Add tenant", icon: UserPlus },
  { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard/vacated", label: "Vacated", icon: Archive },
] as const;

const ISSUE_CATEGORY: Record<string, string> = {
  electricity: "Electricity",
  plumbing: "Plumbing",
  wifi: "WiFi",
  cleaning: "Cleaning",
  noise: "Noise",
  other: "Other",
};

export default async function AdminDashboard() {
  const user = await requireRole(["admin", "staff"]);

  // GVM-style editions get a stripped, mobile-first quick-action home.
  const client = await getEdition();
  if (client.edition === "gvm") {
    return <GvmHome ownerName={client.brandName} />;
  }

  const month = currentMonth();

  const [kpis, payTenants, bill, allIssues] = await Promise.all([
    adminKpis(month),
    getPayTenants(),
    getMonthBill(month),
    listIssuesWithTenant(),
  ]);
  const todayISO = new Date().toISOString().slice(0, 10);
  const dueRows = bill
    .filter((r) => r.balance > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const openIssues = allIssues.filter((i) => i.status !== "resolved").slice(0, 4);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Dashboard"
        title={`Good day, ${user.full_name.split(" ")[0]}`}
        subtitle="Here's how your PG is doing this month."
        action={<RecordPaymentDialog tenants={payTenants} month={month} />}
      />

      {/* quick actions — the everyday jobs, one tap away */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map((q) => (
          <Link
            key={q.label}
            href={q.href}
            className="hover-card group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-inset ring-clay-100">
              <q.icon className="size-5" />
            </span>
            <span className="text-sm font-semibold text-ink group-hover:text-clay-700">{q.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active tenants" value={String(kpis.totalTenants)} icon={Users} accent="clay" hint={`${kpis.roomCount} rooms`} />
        <StatCard label="Beds occupied" value={`${kpis.occupancyPct}%`} icon={BedDouble} accent="teal" hint={`${kpis.occupiedBeds}/${kpis.totalBeds} beds`} progress={kpis.occupancyPct} />
        <StatCard label="Collected (month)" value={inrCompact(kpis.collected)} icon={IndianRupee} accent="gold" hint={`of ${inrCompact(kpis.billed)} billed`} />
        <StatCard label="Amount due (month)" value={inrCompact(kpis.due)} icon={TrendingDown} accent="rose" hint={`${dueRows.length} tenants pending`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between p-5 sm:p-6">
            <div>
              <h3 className="text-lg text-ink">Collections due this month</h3>
              <p className="mt-0.5 text-sm text-ink-muted">Sorted by due date — collect on time.</p>
            </div>
            <Link href="/dashboard/calendar" className="inline-flex items-center gap-1 text-sm font-semibold text-clay-600 hover:text-clay-700">
              Calendar <ArrowUpRight className="size-4" />
            </Link>
          </div>
          {dueRows.length === 0 ? (
            <div className="p-6 pt-0">
              <EmptyState icon={IndianRupee} title="All clear" body="Every tenant has paid this month. 🎉" />
            </div>
          ) : (
            <div className="divide-y divide-line border-t border-line">
              {dueRows.map((row) => (
                <div key={row.tenant_id} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-clay-50 text-xs font-bold text-clay-600">
                      {row.room}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{row.name}</p>
                      <p className={`text-xs ${row.due_date < todayISO ? "font-semibold text-rose-600" : "text-ink-muted"}`}>
                        Due {formatDate(row.due_date)}{row.due_date < todayISO ? " · overdue" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-rose-600 tnum">{inr(row.balance)}</span>
                    <RecordPaymentDialog
                      tenants={payTenants}
                      month={month}
                      preselectId={row.tenant_id}
                      variant="collect"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between p-5 sm:p-6">
            <h3 className="text-lg text-ink">Open complaints</h3>
            <Link href="/dashboard/issues" className="text-sm font-semibold text-clay-600 hover:text-clay-700">
              View all
            </Link>
          </div>
          {openIssues.length === 0 ? (
            <div className="p-6 pt-0">
              <EmptyState icon={MessagesSquare} title="Nothing pending" body="No open issues right now." />
            </div>
          ) : (
            <div className="divide-y divide-line border-t border-line">
              {openIssues.map((issue) => (
                <div key={issue.id} className="px-5 py-3.5 sm:px-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {ISSUE_CATEGORY[issue.category]}
                    </span>
                    <IssueStatusPill status={issue.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{issue.description}</p>
                  <p className="mt-1 text-xs text-ink-muted">— {issue.tenant_name}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
