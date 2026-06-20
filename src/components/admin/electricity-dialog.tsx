"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input } from "@/components/ui/field";
import { recordElectricityAction, type ActionState } from "@/lib/actions/admin";
import { inr } from "@/lib/utils";

export function ElectricityDialog({
  tenantId,
  month,
  includedUnits,
  perUnitRate,
}: {
  tenantId: string;
  month: string;
  includedUnits: number;
  perUnitRate: number;
}) {
  return (
    <Modal
      title="Record electricity"
      description="Enter this month's units — the charge is added to the tenant's bill."
      trigger={(open) => (
        <Button variant="outline" size="sm" onClick={open}>
          <Zap className="size-4" /> Electricity
        </Button>
      )}
    >
      {(close) => (
        <ElecForm
          tenantId={tenantId}
          month={month}
          includedUnits={includedUnits}
          perUnitRate={perUnitRate}
          onDone={close}
        />
      )}
    </Modal>
  );
}

function ElecForm({
  tenantId,
  month,
  includedUnits,
  perUnitRate,
  onDone,
}: {
  tenantId: string;
  month: string;
  includedUnits: number;
  perUnitRate: number;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    recordElectricityAction,
    {},
  );
  const [units, setUnits] = useState("0");
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const u = Number(units) || 0;
  const charge = Math.max(0, Math.round((u - includedUnits) * perUnitRate));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="month_for" value={month} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <FieldRow label="Units used this month" htmlFor="units">
        <Input
          id="units"
          name="units"
          type="number"
          min={0}
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          required
        />
      </FieldRow>
      <div className="rounded-xl border border-line bg-paper-2/40 p-4 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-ink-muted">Free units</span>
          <span className="tnum text-ink-soft">{includedUnits}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-ink-muted">Billable</span>
          <span className="tnum text-ink-soft">
            {Math.max(0, u - includedUnits)} × {inr(perUnitRate)}
          </span>
        </div>
        <div className="mt-1 flex justify-between border-t border-line pt-2">
          <span className="font-semibold text-ink">Electricity charge</span>
          <span className="font-display text-lg font-semibold text-ink tnum">{inr(charge)}</span>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Add to bill"}
        </Button>
      </div>
    </form>
  );
}
