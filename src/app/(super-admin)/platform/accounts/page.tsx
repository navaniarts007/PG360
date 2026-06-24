import Link from "next/link";
import type { Metadata } from "next";
import { Building2, MapPin, Phone, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PgStatusPill } from "@/components/ui/status";
import { CreatePgDialog } from "@/components/platform/create-pg-dialog";
import { PgStatusToggle } from "@/components/platform/pg-status-toggle";
import { listPgAccounts } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "PG accounts" };

const typeLabel = { boys: "Boys", girls: "Girls", coliving: "Co-living" } as const;

export default async function AccountsPage() {
  const pgs = await listPgAccounts();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Super admin"
        title="PG accounts"
        subtitle="Onboard new owners, and suspend or reactivate any PG on the platform."
        action={<CreatePgDialog />}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-2/40 text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-6 py-3.5 font-semibold">PG &amp; owner</th>
                <th className="px-6 py-3.5 font-semibold">Location</th>
                <th className="px-6 py-3.5 font-semibold">Type</th>
                <th className="px-6 py-3.5 font-semibold">Plan</th>
                <th className="px-6 py-3.5 font-semibold">Expires</th>
                <th className="px-6 py-3.5 font-semibold">Status</th>
                <th className="px-6 py-3.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {pgs.map((pg) => (
                <tr key={pg.id} className="border-b border-line last:border-0 hover:bg-paper-2/30">
                  <td className="px-6 py-4">
                    <Link href={`/platform/accounts/${pg.id}`} className="group flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
                        <Building2 className="size-4.5" />
                      </span>
                      <div>
                        <p className="flex items-center gap-2 font-semibold text-ink group-hover:text-clay-700">
                          {pg.pg_name}
                          {pg.edition === "gvm" && <Badge tone="clay">Stripped</Badge>}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-ink-muted">
                          <Phone className="size-3" /> {pg.owner_name} · {pg.mobile}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-ink-soft">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-ink-muted" /> {pg.location}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge tone="neutral">{typeLabel[pg.pg_type]}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge tone="clay">{pg.subscription_plan}</Badge>
                  </td>
                  <td className="px-6 py-4 text-ink-muted tnum">{formatDate(pg.subscription_expiry)}</td>
                  <td className="px-6 py-4">
                    <PgStatusPill status={pg.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/platform/accounts/${pg.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-clay-50 px-3 py-1.5 text-xs font-semibold text-clay-700 transition-colors hover:bg-clay-100"
                      >
                        <Settings2 className="size-3.5" /> Manage
                      </Link>
                      <PgStatusToggle id={pg.id} status={pg.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
