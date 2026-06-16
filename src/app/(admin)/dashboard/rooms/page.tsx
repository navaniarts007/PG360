import type { Metadata } from "next";
import { BedDouble, IndianRupee, Tag, Wifi } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RoomStatusPill } from "@/components/ui/status";
import { AddRoomDialog } from "@/components/admin/add-room-dialog";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { FloorSection } from "@/components/admin/floor-section";
import { deleteRoomAction } from "@/lib/actions/admin";
import { requireRole } from "@/lib/guards";
import { listBedsByRoom, listRateCards, type RoomBeds } from "@/lib/db";
import { inr, inrCompact } from "@/lib/utils";
import type { RateCard } from "@/lib/types";

export const metadata: Metadata = { title: "Rooms & beds" };

const TYPE: Record<string, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  quad: "Four sharing",
  dorm: "Dormitory",
};

const floorLabel = (n: number) =>
  n === 0 ? "Ground floor" : `Floor ${n}`;

export default async function RoomsPage() {
  await requireRole(["admin", "staff"]);
  const [roomBeds, rateCards] = await Promise.all([listBedsByRoom(), listRateCards()]);

  const allBeds = roomBeds.flatMap((r) => r.beds);
  const totalBeds = allBeds.length;
  const occupied = allBeds.filter((b) => b.status === "occupied").length;
  const vacant = totalBeds - occupied;
  const revenueGap = allBeds
    .filter((b) => b.status === "vacant")
    .reduce((s, b) => s + b.price_per_month, 0);

  // group rooms under floors
  const byFloor = new Map<number, RoomBeds[]>();
  for (const rb of roomBeds) {
    const list = byFloor.get(rb.room.floor) ?? [];
    list.push(rb);
    byFloor.set(rb.room.floor, list);
  }
  const floors = [...byFloor.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Inventory"
        title="Rooms & beds"
        subtitle={`${roomBeds.length} rooms across ${floors.length} ${floors.length === 1 ? "floor" : "floors"} · ${occupied}/${totalBeds} beds filled`}
        action={<AddRoomDialog rateCards={rateCards} />}
      />

      {rateCards.length === 0 && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-gold-200 bg-gold-50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-gold-600">
            <Tag className="size-4" /> Add a rate card first — rooms price their beds from it.
          </p>
          <Link href="/dashboard/pricing" className="text-sm font-semibold text-clay-600 hover:text-clay-700">
            Go to Pricing →
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryStat icon={BedDouble} accent="teal" label="Beds filled" value={`${occupied}/${totalBeds}`} sub={`${totalBeds ? Math.round((occupied / totalBeds) * 100) : 0}% occupancy`} />
        <SummaryStat icon={BedDouble} accent="rose" label="Vacant beds" value={String(vacant)} sub="earning nothing" />
        <SummaryStat icon={IndianRupee} accent="gold" label="Revenue gap" value={inrCompact(revenueGap)} sub="per month from vacant beds" />
      </div>

      {roomBeds.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="No rooms yet"
          body="Add your first room — beds are created automatically from the rate card."
          action={<AddRoomDialog rateCards={rateCards} />}
        />
      ) : (
        <div className="space-y-4">
          {floors.map(([floor, list], i) => {
            const beds = list.flatMap((r) => r.beds);
            const filled = beds.filter((b) => b.status === "occupied").length;
            return (
              <FloorSection
                key={floor}
                label={floorLabel(floor)}
                rooms={list.length}
                bedsFilled={filled}
                bedsTotal={beds.length}
                vacant={beds.length - filled}
                defaultOpen={i === 0}
              >
                {list.map(({ room, beds }) => (
                  <RoomCard key={room.id} room={room} beds={beds} rateCards={rateCards} />
                ))}
              </FloorSection>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RoomCard({
  room,
  beds,
  rateCards,
}: {
  room: RoomBeds["room"];
  beds: RoomBeds["beds"];
  rateCards: RateCard[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-xl font-semibold text-ink">Room {room.room_number}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
            {TYPE[room.type] ?? room.type}
            <span className="inline-flex items-center gap-1">
              <Wifi className="size-3" /> {room.wifi_password}
            </span>
          </p>
        </div>
        <RoomStatusPill status={room.status} />
      </div>

      <div className="mt-4 space-y-1.5">
        {beds.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paper-2/40 px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2">
              <span
                className={
                  b.status === "occupied"
                    ? "size-2 rounded-full bg-clay-500"
                    : "size-2 rounded-full bg-teal-400"
                }
              />
              <span className="font-medium text-ink">Bed {b.bed_number}</span>
              <span className="text-ink-muted">
                {b.status === "occupied" ? `· ${b.tenant_name ?? "Occupied"}` : "· Vacant"}
              </span>
            </span>
            <span className="font-semibold text-ink tnum">{inr(b.price_per_month)}</span>
          </div>
        ))}
        {beds.length === 0 && <p className="text-sm text-ink-muted">No beds.</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <div className="flex flex-wrap gap-1.5">
          {room.amenities.map((a) => (
            <Badge key={a} tone="neutral">{a}</Badge>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <AddRoomDialog rateCards={rateCards} room={room} />
          <ConfirmDelete action={deleteRoomAction} id={room.id} title="Delete room" />
        </div>
      </div>
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
