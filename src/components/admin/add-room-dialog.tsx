"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import {
  addRoomAction,
  updateRoomAction,
  type ActionState,
} from "@/lib/actions/admin";
import type { RateCard, Room } from "@/lib/types";
import { inr } from "@/lib/utils";

export function AddRoomDialog({
  rateCards,
  room,
}: {
  rateCards: RateCard[];
  room?: Room;
}) {
  const isEdit = !!room;
  return (
    <Modal
      title={isEdit ? `Edit Room ${room.room_number}` : "Add a room"}
      description={
        isEdit
          ? "Beds and rent follow the chosen rate card."
          : "Pick a rate card — beds are created and priced automatically."
      }
      trigger={(open) =>
        isEdit ? (
          <button
            onClick={open}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-paper-2 hover:text-clay-600"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
        ) : (
          <Button onClick={open} disabled={rateCards.length === 0}>
            <Plus className="size-4" /> Add room
          </Button>
        )
      }
    >
      {(close) => <RoomForm rateCards={rateCards} room={room} onDone={close} />}
    </Modal>
  );
}

function RoomForm({
  rateCards,
  room,
  onDone,
}: {
  rateCards: RateCard[];
  room?: Room;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    room ? updateRoomAction : addRoomAction,
    {},
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="space-y-4">
      {room && <input type="hidden" name="id" value={room.id} />}
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <FieldRow label={room ? "Rate card (re-price)" : "Rate card"} htmlFor="rate_card_id">
        <Select id="rate_card_id" name="rate_card_id" defaultValue="" required={!room}>
          {room && <option value="">— keep current pricing —</option>}
          {!room && <option value="" disabled>Select a rate card…</option>}
          {rateCards.map((rc) => (
            <option key={rc.id} value={rc.id}>
              {rc.name} · {inr(rc.price_per_month)}/bed
            </option>
          ))}
        </Select>
      </FieldRow>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Room number" htmlFor="room_number">
          <Input id="room_number" name="room_number" defaultValue={room?.room_number ?? ""} placeholder="201" required />
        </FieldRow>
        <FieldRow label="Floor" htmlFor="floor">
          <Input id="floor" name="floor" type="number" min={0} defaultValue={room?.floor ?? 1} />
        </FieldRow>
        <FieldRow label="Total beds" htmlFor="total_beds">
          <Input id="total_beds" name="total_beds" type="number" min={1} defaultValue={room?.total_beds ?? 2} />
        </FieldRow>
        <FieldRow label="WiFi password" htmlFor="wifi_password">
          <Input id="wifi_password" name="wifi_password" defaultValue={room?.wifi_password ?? ""} placeholder="Sunrise@201" required />
        </FieldRow>
      </div>
      <FieldRow label="Amenities" htmlFor="amenities" hint="comma separated">
        <Input id="amenities" name="amenities" defaultValue={room?.amenities.join(", ") ?? ""} placeholder="AC, Attached bath, Geyser" />
      </FieldRow>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : room ? "Save changes" : "Add room"}
        </Button>
      </div>
    </form>
  );
}
