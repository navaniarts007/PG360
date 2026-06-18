"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input } from "@/components/ui/field";
import { createStaffAction, type ActionState } from "@/lib/actions/staff";

export function AddStaffDialog() {
  return (
    <Modal
      title="Add a staff member"
      description="They'll get a login to help manage this property."
      trigger={(open) => (
        <Button onClick={open}>
          <Plus className="size-4" /> Add staff
        </Button>
      )}
    >
      {(close) => <StaffForm onDone={close} />}
    </Modal>
  );
}

function StaffForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createStaffAction,
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
        <FieldRow label="Full name" htmlFor="name" className="col-span-2">
          <Input id="name" name="name" placeholder="e.g. Priya Nair" required />
        </FieldRow>
        <FieldRow label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" placeholder="9876543210" required />
        </FieldRow>
        <FieldRow label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" placeholder="staff@pg.in" required />
        </FieldRow>
        <FieldRow
          label="Login password"
          htmlFor="login_password"
          hint="6+ characters"
          className="col-span-2"
        >
          <Input
            id="login_password"
            name="login_password"
            type="text"
            placeholder="Set a password they can change later"
            required
          />
        </FieldRow>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Adding…
            </>
          ) : (
            "Add staff"
          )}
        </Button>
      </div>
    </form>
  );
}
