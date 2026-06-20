import { Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RoomStatusPill } from "@/components/ui/status";
import { AddRoomDialog } from "@/components/admin/add-room-dialog";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { deleteRoomAction } from "@/lib/actions/admin";
import { inr } from "@/lib/utils";
import type { RoomBeds } from "@/lib/db";
import type { RateCard, WifiNetwork } from "@/lib/types";

const TYPE: Record<string, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  quad: "Four sharing",
  dorm: "Dormitory",
};

export function RoomCard({
  room,
  beds,
  rateCards,
  floors,
  wifiNetworks,
}: {
  room: RoomBeds["room"];
  beds: RoomBeds["beds"];
  rateCards: RateCard[];
  floors: { id: string; label: string }[];
  wifiNetworks: WifiNetwork[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-xl font-semibold text-ink">Room {room.room_number}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
            {TYPE[room.type] ?? room.type}
            {(room.wifi_ssid || room.wifi_password) && (
              <span className="inline-flex items-center gap-1">
                <Wifi className="size-3" /> {room.wifi_ssid ?? room.wifi_password}
              </span>
            )}
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
              <span className={b.status === "occupied" ? "size-2 rounded-full bg-clay-500" : "size-2 rounded-full bg-teal-400"} />
              <span className="font-medium text-ink">Bed {b.bed_number}</span>
              <span className="text-ink-muted">
                {b.status === "occupied" ? `· ${b.tenant_name ?? "Occupied"}` : "· Vacant"}
              </span>
            </span>
            <span className="font-semibold text-ink tnum">{inr(b.price_per_month)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <div className="flex flex-wrap gap-1.5">
          {room.amenities.map((a) => (
            <Badge key={a} tone="neutral">{a}</Badge>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <AddRoomDialog rateCards={rateCards} floors={floors} wifiNetworks={wifiNetworks} room={room} />
          <ConfirmDelete action={deleteRoomAction} id={room.id} title="Delete room" />
        </div>
      </div>
    </div>
  );
}
