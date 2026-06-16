"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import {
  createRateCardAction,
  updateRateCardAction,
  type ActionState,
} from "@/lib/actions/ratecard";
import type { RateCard } from "@/lib/types";

export function RateCardDialog({ card }: { card?: RateCard }) {
  const isEdit = !!card;
  return (
    <Modal
      title={isEdit ? "Edit rate card" : "Add a rate card"}
      description="Set the per-bed monthly price for a sharing type."
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
            <Plus className="size-4" /> Add rate card
          </Button>
        )
      }
    >
      {(close) => <RateForm card={card} onDone={close} />}
    </Modal>
  );
}

function RateForm({ card, onDone }: { card?: RateCard; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    card ? updateRateCardAction : createRateCardAction,
    {},
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="space-y-4">
      {card && <input type="hidden" name="id" value={card.id} />}
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <FieldRow label="Name" htmlFor="name">
        <Input id="name" name="name" defaultValue={card?.name ?? ""} placeholder="Double Sharing · AC" required />
      </FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Sharing" htmlFor="room_type">
          <Select id="room_type" name="room_type" defaultValue={card?.room_type ?? "double"}>
            <option value="single">Single</option>
            <option value="double">Double</option>
            <option value="triple">Triple</option>
            <option value="quad">Four sharing</option>
            <option value="dorm">Dormitory</option>
          </Select>
        </FieldRow>
        <FieldRow label="Price / bed / month (₹)" htmlFor="price_per_month">
          <Input id="price_per_month" name="price_per_month" type="number" min={0} defaultValue={card?.price_per_month ?? ""} placeholder="12000" required />
        </FieldRow>
        <FieldRow label="AC" htmlFor="ac">
          <Select id="ac" name="ac" defaultValue={card ? String(card.ac) : "false"}>
            <option value="false">Non-AC</option>
            <option value="true">AC</option>
          </Select>
        </FieldRow>
        <FieldRow label="Bathroom" htmlFor="bath_type">
          <Select id="bath_type" name="bath_type" defaultValue={card?.bath_type ?? "common"}>
            <option value="common">Common</option>
            <option value="attached">Attached</option>
          </Select>
        </FieldRow>
        <FieldRow label="Food" htmlFor="food_included">
          <Select id="food_included" name="food_included" defaultValue={card ? String(card.food_included) : "true"}>
            <option value="true">Included</option>
            <option value="false">Not included</option>
          </Select>
        </FieldRow>
        <FieldRow label="Opt-out deduction (₹)" htmlFor="food_opt_out_deduction" hint="if food off">
          <Input id="food_opt_out_deduction" name="food_opt_out_deduction" type="number" min={0} defaultValue={card?.food_opt_out_deduction ?? 0} />
        </FieldRow>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : card ? "Save changes" : "Add rate card"}
        </Button>
      </div>
    </form>
  );
}
