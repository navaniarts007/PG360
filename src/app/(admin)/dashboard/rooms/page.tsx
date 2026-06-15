import type { Metadata } from "next";
import { BedDouble, IndianRupee, Layers, Wifi } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RoomStatusPill } from "@/components/ui/status";
import { Badge } from "@/components/ui/badge";
import { AddRoomDialog } from "@/components/admin/add-room-dialog";
import { requireRole } from "@/lib/guards";
import { listRooms } from "@/lib/db";
import { inr } from "@/lib/utils";

export const metadata: Metadata = { title: "Rooms" };

const TYPE: Record<string, string> = { single: "Single", double: "Double", triple: "Triple" };

export default async function RoomsPage() {
  await requireRole(["admin", "staff"]);
  const rooms = await listRooms();

  const totalBeds = rooms.reduce((s, r) => s + r.total_beds, 0);
  const occupied = rooms.reduce((s, r) => s + r.occupied_beds, 0);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Inventory"
        title="Rooms & beds"
        subtitle={`${rooms.length} rooms · ${occupied}/${totalBeds} beds occupied`}
        action={<AddRoomDialog />}
      />

      {rooms.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="No rooms yet"
          body="Add your first room to start tracking beds and rent."
          action={<AddRoomDialog />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const free = room.total_beds - room.occupied_beds;
            return (
              <div
                key={room.id}
                className="group flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-2xl font-semibold text-ink">
                      Room {room.room_number}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                      <Layers className="size-3.5" /> Floor {room.floor} · {TYPE[room.type]}
                    </p>
                  </div>
                  <RoomStatusPill status={room.status} />
                </div>

                {/* bed pips */}
                <div className="mt-4 flex items-center gap-1.5">
                  {Array.from({ length: room.total_beds }).map((_, i) => (
                    <span
                      key={i}
                      className={
                        i < room.occupied_beds
                          ? "h-2 flex-1 rounded-full bg-clay-400"
                          : "h-2 flex-1 rounded-full bg-paper-2 ring-1 ring-inset ring-line"
                      }
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  {room.occupied_beds}/{room.total_beds} occupied
                  {free > 0 && <span className="text-teal-600"> · {free} free</span>}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {room.amenities.map((a) => (
                    <Badge key={a} tone="neutral">
                      {a}
                    </Badge>
                  ))}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
                  <span className="flex items-center gap-1 font-semibold text-ink tnum">
                    <IndianRupee className="size-4 text-ink-muted" />
                    {inr(room.rent_amount).replace("₹", "")}
                    <span className="text-xs font-normal text-ink-muted">/bed</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 font-mono text-xs text-gold-200">
                    <Wifi className="size-3.5" /> {room.wifi_password}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
