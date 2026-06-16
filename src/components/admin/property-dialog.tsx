"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, Building2, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import {
  createPropertyAction,
  updatePropertyAction,
  type ActionState,
} from "@/lib/actions/property";
import type { PgAccount } from "@/lib/types";

export function PropertyDialog({ property }: { property?: PgAccount }) {
  const isEdit = !!property;
  return (
    <Modal
      title={isEdit ? "Edit property" : "Add a property"}
      description={
        isEdit ? "Update this property's details." : "Add another property to your portfolio."
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
          <Button onClick={open}>
            <Plus className="size-4" /> Add property
          </Button>
        )
      }
    >
      {(close) => <PropertyForm property={property} onDone={close} />}
    </Modal>
  );
}

function PropertyForm({
  property,
  onDone,
}: {
  property?: PgAccount;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    property ? updatePropertyAction : createPropertyAction,
    {},
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="space-y-4">
      {property && <input type="hidden" name="id" value={property.id} />}
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <FieldRow label="Property name" htmlFor="pg_name">
        <Input id="pg_name" name="pg_name" defaultValue={property?.pg_name ?? ""} placeholder="Sunrise Stay" required />
      </FieldRow>
      <FieldRow label="Location" htmlFor="location">
        <Input id="location" name="location" defaultValue={property?.location ?? ""} placeholder="Koramangala, Bengaluru" required />
      </FieldRow>
      <FieldRow label="Mobile" htmlFor="mobile">
        <Input id="mobile" name="mobile" defaultValue={property?.mobile ?? ""} placeholder="+9198…" required />
      </FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Type" htmlFor="pg_type">
          <Select id="pg_type" name="pg_type" defaultValue={property?.pg_type ?? "coliving"}>
            <option value="boys">Boys</option>
            <option value="girls">Girls</option>
            <option value="coliving">Co-living</option>
          </Select>
        </FieldRow>
        <FieldRow label="Category" htmlFor="category">
          <Select id="category" name="category" defaultValue={property?.category ?? "standard"}>
            <option value="budget">Budget</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </Select>
        </FieldRow>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? (
            <><Loader2 className="size-4 animate-spin" /> Saving…</>
          ) : property ? (
            "Save changes"
          ) : (
            <><Building2 className="size-4" /> Add property</>
          )}
        </Button>
      </div>
    </form>
  );
}
