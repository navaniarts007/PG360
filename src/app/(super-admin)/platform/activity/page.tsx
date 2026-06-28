import type { Metadata } from "next";
import { History } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Filterable } from "@/components/app/filterable";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/guards";
import { listAllActivity } from "@/lib/db";

export const metadata: Metadata = { title: "Activity log" };

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default async function PlatformActivityPage() {
  await requireRole(["super_admin"]);
  const rows = await listAllActivity();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Super admin"
        title="Activity log"
        subtitle="Platform-wide audit trail — every account, billing and admin action."
      />

      {rows.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" body="Platform actions will appear here." />
      ) : (
        <Filterable placeholder="Search by PG, person or action…">
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} data-search={`${r.detail ?? ""} ${r.actor_name ?? ""} ${r.pg_name ?? ""} ${r.action}`} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-clay-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{r.detail ?? r.action}</p>
                    <p className="text-xs text-ink-muted">
                      {r.actor_name ?? "—"}
                      {r.actor_role ? ` · ${r.actor_role}` : ""}
                      {r.pg_name ? ` · ${r.pg_name}` : " · platform"}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs text-ink-muted tnum">{when(r.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Filterable>
      )}
    </div>
  );
}
