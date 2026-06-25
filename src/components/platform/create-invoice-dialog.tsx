"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, FilePlus2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { createInvoiceAction, type ActionState } from "@/lib/actions/platform";
import { inr } from "@/lib/utils";

export function CreateInvoiceDialog({ pgId }: { pgId: string }) {
  return (
    <Modal
      title="Generate an invoice"
      description="Bill this client for their PG360 subscription. Amount is fully customizable."
      trigger={(open) => (
        <Button variant="outline" onClick={open}>
          <FilePlus2 className="size-4" /> New invoice
        </Button>
      )}
    >
      {(close) => <InvoiceForm pgId={pgId} onDone={close} />}
    </Modal>
  );
}

function InvoiceForm({ pgId, onDone }: { pgId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createInvoiceAction,
    {},
  );
  const [amount, setAmount] = useState(0);
  const [tax, setTax] = useState(0);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const total = amount + Math.round((amount * tax) / 100);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="pg_id" value={pgId} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <FieldRow label="Description" htmlFor="description">
        <Input id="description" name="description" defaultValue="PG360 subscription" required />
      </FieldRow>

      <FieldRow label="Billing cycle" htmlFor="billing_cycle">
        <Select id="billing_cycle" name="billing_cycle" defaultValue="one_time">
          <option value="one_time">One-time payment</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </Select>
      </FieldRow>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Amount (₹)" htmlFor="amount">
          <Input id="amount" name="amount" type="number" min={0} value={amount} onChange={(e) => setAmount(+e.target.value)} required />
        </FieldRow>
        <FieldRow label="GST / tax (%)" htmlFor="tax_percent" hint="optional">
          <Input id="tax_percent" name="tax_percent" type="number" min={0} max={100} value={tax} onChange={(e) => setTax(+e.target.value)} />
        </FieldRow>
        <FieldRow label="Billing period" htmlFor="period_label" hint="optional">
          <Input id="period_label" name="period_label" placeholder="Jun 2026 – May 2027" />
        </FieldRow>
        <FieldRow label="Due date" htmlFor="due_date" hint="optional">
          <Input id="due_date" name="due_date" type="date" />
        </FieldRow>
        <FieldRow label="Notes" htmlFor="notes" className="col-span-2" hint="optional">
          <Input id="notes" name="notes" placeholder="Thank you for your business" />
        </FieldRow>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-paper">
        <span className="text-sm text-paper/70">Total payable</span>
        <span className="font-display text-xl font-semibold tnum">{inr(total)}</span>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Generating…
            </>
          ) : (
            "Generate invoice"
          )}
        </Button>
      </div>
    </form>
  );
}
