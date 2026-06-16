import type { Metadata } from "next";
import { Building2, MapPin } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { PgStatusPill } from "@/components/ui/status";
import { PropertyDialog } from "@/components/admin/property-dialog";
import { PropertyControls } from "@/components/admin/property-controls";
import { requireRole } from "@/lib/guards";
import { getActiveProperty, getSession } from "@/lib/auth";
import { listMyProperties } from "@/lib/db";

export const metadata: Metadata = { title: "Properties" };

const TYPE: Record<string, string> = { boys: "Boys", girls: "Girls", coliving: "Co-living" };

export default async function PropertiesPage() {
  await requireRole(["admin", "staff"]);
  const [properties, activeId, session] = await Promise.all([
    listMyProperties(),
    getActiveProperty(),
    getSession(),
  ]);
  const isOwnerAdmin = session?.role === "admin";

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Portfolio"
        title="Properties"
        subtitle={`${properties.length} ${properties.length === 1 ? "property" : "properties"} · switch any time from the sidebar`}
        action={isOwnerAdmin ? <PropertyDialog /> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {properties.map((p) => (
          <div
            key={p.id}
            className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-soft"
          >
            <div className="flex items-start justify-between">
              <span className="grid size-11 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
                <Building2 className="size-5" />
              </span>
              <PgStatusPill status={p.status} />
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold text-ink">{p.pg_name}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
              <MapPin className="size-3.5" /> {p.location}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="neutral">{TYPE[p.pg_type] ?? p.pg_type}</Badge>
              <Badge tone="clay" className="capitalize">{p.category}</Badge>
              <Badge tone="neutral" className="capitalize">{p.subscription_plan}</Badge>
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4">
              <PropertyControls
                propertyId={p.id}
                isActive={p.id === activeId}
                canDelete={isOwnerAdmin && properties.length > 1}
              />
              {isOwnerAdmin && <PropertyDialog property={p} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
