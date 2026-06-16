"use client";

import { useActionState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { createBookingAction, type ActionState } from "@/lib/actions/booking";

export function BookingForm({ pgId }: { pgId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createBookingAction,
    {},
  );

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-500 text-white">
          <CheckCircle2 className="size-7" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-semibold text-ink">Request sent!</h2>
        <p className="mt-2 text-sm text-ink-soft">
          The PG owner has your details and will reach out shortly. 🎉
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="pg_id" value={pgId} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <FieldRow label="Your name" htmlFor="tenant_name">
        <Input id="tenant_name" name="tenant_name" placeholder="e.g. Arjun Nair" required />
      </FieldRow>
      <FieldRow label="Phone" htmlFor="phone">
        <Input id="phone" name="phone" placeholder="+91…" required />
      </FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Room type" htmlFor="preferred_room_type">
          <Select id="preferred_room_type" name="preferred_room_type" defaultValue="any">
            <option value="any">Any</option>
            <option value="single">Single</option>
            <option value="double">Double</option>
            <option value="triple">Triple</option>
          </Select>
        </FieldRow>
        <FieldRow label="Move-in date" htmlFor="requested_date">
          <Input id="requested_date" name="requested_date" type="date" />
        </FieldRow>
      </div>
      <FieldRow label="Anything else?" htmlFor="notes">
        <Input id="notes" name="notes" placeholder="Optional note for the owner" />
      </FieldRow>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            Request a room <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  );
}
