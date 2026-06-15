import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowUpRight,
  Building2,
  IndianRupee,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Card } from "@/components/ui/card";
import { PgStatusPill } from "@/components/ui/status";
import { Badge } from "@/components/ui/badge";
import { CreatePgDialog } from "@/components/platform/create-pg-dialog";
import { listPgAccounts, platformStats } from "@/lib/db";
import { formatDate, inrCompact, inr } from "@/lib/utils";

export const metadata: Metadata = { title: "Platform overview" };

export default async function PlatformOverview() {
  const [stats, all] = await Promise.all([platformStats(), listPgAccounts()]);
  const recent = all.slice(0, 5);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Super admin"
        title="Platform overview"
        subtitle="Every PG on PG360 at a glance. Onboard owners and keep the network healthy."
        action={<CreatePgDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="PG accounts" value={String(stats.totalPgs)} icon={Building2} accent="clay" hint={`${stats.activePgs} active`} />
        <StatCard label="Active subscriptions" value={String(stats.activePgs)} icon={TrendingUp} accent="teal" hint="paying owners" />
        <StatCard label="Tenants on platform" value={String(stats.totalTenants)} icon={Users} accent="gold" hint="across all PGs" />
        <StatCard label="Annual recurring" value={inrCompact(stats.mrr)} icon={IndianRupee} accent="ink" hint="from active plans" />
      </div>

      <Card>
        <div className="flex items-center justify-between p-5 sm:p-6">
          <div>
            <h3 className="text-lg text-ink">Recent PG accounts</h3>
            <p className="mt-0.5 text-sm text-ink-muted">Latest owners onboarded.</p>
          </div>
          <Link
            href="/platform/accounts"
            className="inline-flex items-center gap-1 text-sm font-semibold text-clay-600 hover:text-clay-700"
          >
            Manage all <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line bg-paper-2/40 text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-6 py-3 font-semibold">PG</th>
                <th className="px-6 py-3 font-semibold">Location</th>
                <th className="px-6 py-3 font-semibold">Plan</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((pg) => (
                <tr key={pg.id} className="border-b border-line last:border-0 hover:bg-paper-2/30">
                  <td className="px-6 py-3.5">
                    <p className="font-semibold text-ink">{pg.pg_name}</p>
                    <p className="text-xs text-ink-muted">{pg.owner_name}</p>
                  </td>
                  <td className="px-6 py-3.5 text-ink-soft">{pg.location}</td>
                  <td className="px-6 py-3.5">
                    <Badge tone="clay">{pg.subscription_plan}</Badge>
                  </td>
                  <td className="px-6 py-3.5">
                    <PgStatusPill status={pg.status} />
                  </td>
                  <td className="px-6 py-3.5 text-ink-muted tnum">{formatDate(pg.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="rounded-2xl border border-line bg-gradient-to-br from-clay-50 to-paper-2/40 p-6">
        <p className="font-display text-lg font-semibold text-ink">
          {inr(stats.mrr)} <span className="font-sans text-sm font-normal text-ink-muted">in active annual subscriptions</span>
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {stats.activePgs} of {stats.totalPgs} PGs are active. Suspended accounts keep
          their data but lose access until reactivated.
        </p>
      </div>
    </div>
  );
}
