import Link from "next/link";
import type { Metadata } from "next";
import { Eye, Phone, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TenantStatusPill } from "@/components/ui/status";
import { AddTenantDialog } from "@/components/admin/add-tenant-dialog";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { deleteTenantAction } from "@/lib/actions/admin";
import { requireRole } from "@/lib/guards";
import { getBedOptions, listTenantsWithRoom } from "@/lib/db";
import { initials, inr } from "@/lib/utils";

export const metadata: Metadata = { title: "Tenants" };

export default async function TenantsPage() {
  await requireRole(["admin", "staff"]);
  const [tenants, beds] = await Promise.all([
    listTenantsWithRoom(),
    getBedOptions(),
  ]);

  const active = tenants.filter((t) => t.status === "active").length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="People"
        title="Tenants"
        subtitle={`${active} active · ${tenants.length - active} checked out`}
        action={<AddTenantDialog beds={beds} />}
      />

      {tenants.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No tenants yet"
          body="Add a resident — they'll get their own login automatically."
          action={<AddTenantDialog beds={beds} />}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-2/40 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3.5 font-semibold">Tenant</th>
                  <th className="px-6 py-3.5 font-semibold">Room</th>
                  <th className="px-6 py-3.5 font-semibold">Phone</th>
                  <th className="px-6 py-3.5 font-semibold">Rent</th>
                  <th className="px-6 py-3.5 font-semibold">Status</th>
                  <th className="px-6 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="group border-b border-line last:border-0 hover:bg-paper-2/30">
                    <td className="px-6 py-3.5">
                      <Link href={`/dashboard/tenants/${t.id}`} className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">
                          {initials(t.name)}
                        </span>
                        <div>
                          <p className="font-semibold text-ink group-hover:text-clay-700">{t.name}</p>
                          <p className="text-xs text-ink-muted">{t.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 text-ink-soft">
                      {t.room ? `Room ${t.room.room_number}` : <span className="text-ink-muted">Unassigned</span>}
                    </td>
                    <td className="px-6 py-3.5 text-ink-soft">
                      <span className="flex items-center gap-1.5">
                        <Phone className="size-3.5 text-ink-muted" /> {t.phone}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-ink tnum">{inr(t.rent_amount)}</td>
                    <td className="px-6 py-3.5">
                      <TenantStatusPill status={t.status} />
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/dashboard/tenants/${t.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-clay-50 px-3 py-1.5 text-xs font-semibold text-clay-700 transition-colors hover:bg-clay-100"
                        >
                          <Eye className="size-3.5" /> View
                        </Link>
                        <AddTenantDialog beds={beds} tenant={t} />
                        <ConfirmDelete action={deleteTenantAction} id={t.id} title="Delete tenant" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
