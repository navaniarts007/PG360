"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, Layers, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input } from "@/components/ui/field";
import {
  createFloorAction,
  updateFloorAction,
  type ActionState,
} from "@/lib/actions/floor";
import type { Floor } from "@/lib/types";

export function FloorDialog({ floor }: { floor?: Floor }) {
  const isEdit = !!floor;
  return (
    <Modal
      title={isEdit ? "Rename floor" : "Add a floor"}
      description={isEdit ? "Update this floor's name or order." : "Create a floor, then add rooms into it."}
      trigger={(open) =>
        isEdit ? (
          <button
            onClick={open}
            title="Rename floor"
            className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-paper-2 hover:text-clay-600"
          >
            <Pencil className="size-4" />
          </button>
        ) : (
          <Button onClick={open} variant="outline">
            <Plus className="size-4" /> Add floor
          </Button>
        )
      }
    >
      {(close) => <FloorForm floor={floor} onDone={close} />}
    </Modal>
  );
}

function FloorForm({ floor, onDone }: { floor?: Floor; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    floor ? updateFloorAction : createFloorAction,
    {},
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="space-y-4">
      {floor && <input type="hidden" name="id" value={floor.id} />}
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <FieldRow label="Floor name" htmlFor="name">
          <div className="relative">
            <Layers className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <Input id="name" name="name" defaultValue={floor?.name ?? ""} placeholder="Ground floor" className="pl-9" required />
          </div>
        </FieldRow>
        <FieldRow label="Order" htmlFor="sort_order" hint="lower = first">
          <Input id="sort_order" name="sort_order" type="number" defaultValue={floor?.sort_order ?? 0} className="w-20" />
        </FieldRow>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : floor ? "Save" : "Add floor"}
        </Button>
      </div>
    </form>
  );
}
