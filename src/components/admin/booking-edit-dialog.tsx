"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select, Textarea } from "@/components/ui/field";
import { updateBookingAction, type ActionState } from "@/lib/actions/booking";
import type { Booking } from "@/lib/types";

const ROOM_TYPES = [
  { value: "single", label: "Single" },
  { value: "double", label: "Double" },
  { value: "triple", label: "Triple" },
  { value: "any", label: "Any room" },
] as const;

export function BookingEditDialog({ booking }: { booking: Booking }) {
  return (
    <Modal
      title="Edit request"
      description="Update this room request's details."
      trigger={(open) => (
        <button
          onClick={open}
          title="Edit request"
          className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-paper-2 hover:text-clay-600"
        >
          <Pencil className="size-4" />
        </button>
      )}
    >
      {(close) => <BookingForm booking={booking} onDone={close} />}
    </Modal>
  );
}

function BookingForm({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateBookingAction,
    {},
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={booking.id} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Name" htmlFor="tenant_name" className="col-span-2">
          <Input id="tenant_name" name="tenant_name" defaultValue={booking.tenant_name} required />
        </FieldRow>
        <FieldRow label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={booking.phone} required />
        </FieldRow>
        <FieldRow label="Room type" htmlFor="preferred_room_type">
          <Select
            id="preferred_room_type"
            name="preferred_room_type"
            defaultValue={booking.preferred_room_type}
          >
            {ROOM_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Requested date" htmlFor="requested_date" className="col-span-2">
          <Input
            id="requested_date"
            name="requested_date"
            type="date"
            defaultValue={booking.requested_date ?? ""}
          />
        </FieldRow>
        <FieldRow label="Notes" htmlFor="notes" className="col-span-2">
          <Textarea id="notes" name="notes" defaultValue={booking.notes ?? ""} />
        </FieldRow>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}
