import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, BedDouble, Layers } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { AddRoomDialog } from "@/components/admin/add-room-dialog";
import { RoomCard } from "@/components/admin/room-card";
import { requireRole } from "@/lib/guards";
import { getFloorDetail, getFloorOptions, listRateCards } from "@/lib/db";

export const metadata: Metadata = { title: "Floor" };

export default async function FloorPage({
  params,
}: {
  params: Promise<{ floorId: string }>;
}) {
  await requireRole(["admin", "staff"]);
  const { floorId } = await params;
  const [detail, rateCards, floorOptions] = await Promise.all([
    getFloorDetail(floorId),
    listRateCards(),
    getFloorOptions(),
  ]);
  if (!detail) notFound();
  const { floor, rooms } = detail;

  const beds = rooms.flatMap((r) => r.beds);
  const filled = beds.filter((b) => b.status === "occupied").length;

  return (
    <div className="space-y-7">
      <Link
        href="/dashboard/rooms"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> All floors
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-ink text-paper shadow-lift">
            <Layers className="size-6" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{floor.name}</h1>
            <p className="mt-1 text-ink-soft">
              {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
              {beds.length > 0 && ` · ${filled}/${beds.length} beds filled`}
            </p>
          </div>
        </div>
        <AddRoomDialog rateCards={rateCards} floors={floorOptions} defaultFloorId={floor.id} />
      </div>

      {rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="No rooms on this floor yet"
          body="Add the first room — beds are created and priced from the rate card."
          action={<AddRoomDialog rateCards={rateCards} floors={floorOptions} defaultFloorId={floor.id} />}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rooms.map(({ room, beds }) => (
            <RoomCard key={room.id} room={room} beds={beds} rateCards={rateCards} floors={floorOptions} />
          ))}
        </div>
      )}
    </div>
  );
}
