import Link from "next/link";
import type { Metadata } from "next";
import { Archive, Eye, Phone } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Filterable } from "@/components/app/filterable";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireRole } from "@/lib/guards";
import { listVacated } from "@/lib/db";
import { formatDate, initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Vacated" };

export default async function VacatedPage() {
  await requireRole(["admin", "staff"]);
  const vacated = await listVacated();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Master record"
        title="Vacated tenants"
        subtitle={`${vacated.length} past ${vacated.length === 1 ? "resident" : "residents"} — full records retained for police verification.`}
      />

      {vacated.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="No vacated records yet"
          body="When a tenant checks out, their full profile is archived here."
        />
      ) : (
        <Filterable placeholder="Search by name, phone, reg-no or room…">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-2/40 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3.5 font-semibold">Tenant</th>
                  <th className="px-6 py-3.5 font-semibold">Reg no.</th>
                  <th className="px-6 py-3.5 font-semibold">Room</th>
                  <th className="px-6 py-3.5 font-semibold">Stay</th>
                  <th className="px-6 py-3.5 text-right font-semibold">Record</th>
                </tr>
              </thead>
              <tbody>
                {vacated.map((t) => (
                  <tr
                    key={t.id}
                    data-search={`${t.name} ${t.phone} ${t.reg_no ?? ""} ${t.room_number ? `room ${t.room_number}` : ""}`}
                    className="border-b border-line last:border-0 hover:bg-paper-2/30"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">
                          {initials(t.name)}
                        </span>
                        <div>
                          <p className="font-semibold text-ink">{t.name}</p>
                          <p className="flex items-center gap-1 text-xs text-ink-muted">
                            <Phone className="size-3" /> {t.phone}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-ink-soft">{t.reg_no ?? "—"}</td>
                    <td className="px-6 py-3.5 text-ink-soft">
                      {t.room_number ? `Room ${t.room_number}` : "—"}
                    </td>
                    <td className="px-6 py-3.5 text-ink-soft tnum">
                      {formatDate(t.checkin_date)} → {t.checkout_date ? formatDate(t.checkout_date) : "—"}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex justify-end">
                        <Link
                          href={`/dashboard/tenants/${t.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-clay-50 px-3 py-1.5 text-xs font-semibold text-clay-700 transition-colors hover:bg-clay-100"
                        >
                          <Eye className="size-3.5" /> View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </Filterable>
      )}
    </div>
  );
}
