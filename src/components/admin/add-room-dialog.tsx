"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { addRoomAction, type ActionState } from "@/lib/actions/admin";

export function AddRoomDialog() {
  return (
    <Modal
      title="Add a room"
      description="Status updates automatically as beds fill."
      trigger={(open) => (
        <Button onClick={open}>
          <Plus className="size-4" /> Add room
        </Button>
      )}
    >
      {(close) => <RoomForm onDone={close} />}
    </Modal>
  );
}

function RoomForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addRoomAction,
    {},
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Room number" htmlFor="room_number">
          <Input id="room_number" name="room_number" placeholder="201" required />
        </FieldRow>
        <FieldRow label="Floor" htmlFor="floor">
          <Input id="floor" name="floor" type="number" min={0} defaultValue={1} />
        </FieldRow>
        <FieldRow label="Type" htmlFor="type">
          <Select id="type" name="type" defaultValue="double">
            <option value="single">Single</option>
            <option value="double">Double</option>
            <option value="triple">Triple</option>
          </Select>
        </FieldRow>
        <FieldRow label="Total beds" htmlFor="total_beds">
          <Input id="total_beds" name="total_beds" type="number" min={1} defaultValue={2} />
        </FieldRow>
        <FieldRow label="Rent / bed (₹)" htmlFor="rent_amount">
          <Input id="rent_amount" name="rent_amount" type="number" min={0} placeholder="12000" required />
        </FieldRow>
        <FieldRow label="WiFi password" htmlFor="wifi_password">
          <Input id="wifi_password" name="wifi_password" placeholder="Sunrise@201" required />
        </FieldRow>
      </div>
      <FieldRow label="Amenities" htmlFor="amenities" hint="comma separated">
        <Input id="amenities" name="amenities" placeholder="AC, Attached bath, Geyser" />
      </FieldRow>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Adding…</> : "Add room"}
        </Button>
      </div>
    </form>
  );
}
