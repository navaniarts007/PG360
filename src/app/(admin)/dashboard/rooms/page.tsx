import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, ChevronRight, Eye, IndianRupee, Layers } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FloorDialog } from "@/components/admin/floor-dialog";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { deleteFloorAction } from "@/lib/actions/floor";
import { requireRole } from "@/lib/guards";
import { listFloorsWithRooms } from "@/lib/db";
import { inrCompact } from "@/lib/utils";

export const metadata: Metadata = { title: "Rooms & beds" };

export default async function RoomsPage() {
  await requireRole(["admin", "staff"]);
  const floors = await listFloorsWithRooms();

  const allBeds = floors.flatMap((f) => f.rooms.flatMap((r) => r.beds));
  const totalBeds = allBeds.length;
  const occupied = allBeds.filter((b) => b.status === "occupied").length;
  const vacant = totalBeds - occupied;
  const revenueGap = allBeds
    .filter((b) => b.status === "vacant")
    .reduce((s, b) => s + b.price_per_month, 0);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Inventory"
        title="Rooms & beds"
        subtitle={`${floors.length} ${floors.length === 1 ? "floor" : "floors"} · ${occupied}/${totalBeds} beds filled`}
        action={<FloorDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryStat icon={BedDouble} accent="teal" label="Beds filled" value={`${occupied}/${totalBeds}`} sub={`${totalBeds ? Math.round((occupied / totalBeds) * 100) : 0}% occupancy`} />
        <SummaryStat icon={BedDouble} accent="rose" label="Vacant beds" value={String(vacant)} sub="earning nothing" />
        <SummaryStat icon={IndianRupee} accent="gold" label="Revenue gap" value={inrCompact(revenueGap)} sub="per month from vacant beds" />
      </div>

      {floors.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No floors yet"
          body="Create a floor first — then add rooms into it."
          action={<FloorDialog />}
        />
      ) : (
        <div className="space-y-3">
          {floors.map(({ floor, rooms }) => {
            const beds = rooms.flatMap((r) => r.beds);
            const filled = beds.filter((b) => b.status === "occupied").length;
            const floorVacant = beds.length - filled;
            return (
              <div
                key={floor.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft transition-all hover:shadow-lift sm:p-5"
              >
                <Link href={`/dashboard/rooms/${floor.id}`} className="group flex flex-1 items-center gap-4">
                  <span className="grid size-11 place-items-center rounded-xl bg-paper-2 text-ink-soft ring-1 ring-line transition-colors group-hover:bg-clay-50 group-hover:text-clay-600">
                    <Layers className="size-5" />
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold text-ink group-hover:text-clay-700">
                      {floor.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
                      {beds.length > 0 && ` · ${filled}/${beds.length} beds filled`}
                    </p>
                  </div>
                </Link>

                <div className="flex items-center gap-1.5">
                  {floorVacant > 0 && (
                    <span className="hidden rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 ring-1 ring-rose-100 sm:inline">
                      {floorVacant} vacant
                    </span>
                  )}
                  <FloorDialog floor={floor} />
                  <ConfirmDelete action={deleteFloorAction} id={floor.id} title="Delete floor" />
                  <Link
                    href={`/dashboard/rooms/${floor.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-paper transition-colors hover:bg-ink-soft"
                  >
                    <Eye className="size-3.5" /> View
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  accent,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  accent: "teal" | "rose" | "gold";
  label: string;
  value: string;
  sub: string;
}) {
  const tone = {
    teal: "bg-teal-50 text-teal-600 ring-teal-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
    gold: "bg-gold-50 text-gold-600 ring-gold-100",
  }[accent];
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <span className={`grid size-11 place-items-center rounded-xl ring-1 ring-inset ${tone}`}>
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold text-ink tnum">{value}</p>
        <p className="text-sm font-medium text-ink-soft">{label}</p>
        <p className="text-xs text-ink-muted">{sub}</p>
      </div>
    </div>
  );
}
