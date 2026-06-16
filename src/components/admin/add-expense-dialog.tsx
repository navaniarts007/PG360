"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { addExpenseAction, type ActionState } from "@/lib/actions/admin";

const CATEGORIES = [
  "rent",
  "salaries",
  "utilities",
  "groceries",
  "maintenance",
  "supplies",
  "marketing",
  "other",
] as const;

export function AddExpenseDialog({ defaultDate }: { defaultDate: string }) {
  return (
    <Modal
      title="Log an expense"
      description="Track what your PG spends to get an accurate P&L."
      trigger={(open) => (
        <Button onClick={open}>
          <Plus className="size-4" /> Add expense
        </Button>
      )}
    >
      {(close) => <ExpenseForm defaultDate={defaultDate} onDone={close} />}
    </Modal>
  );
}

function ExpenseForm({
  defaultDate,
  onDone,
}: {
  defaultDate: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addExpenseAction,
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
        <FieldRow label="Category" htmlFor="category">
          <Select id="category" name="category" defaultValue="utilities">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c[0]!.toUpperCase() + c.slice(1)}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Amount (₹)" htmlFor="amount">
          <Input id="amount" name="amount" type="number" min={0} placeholder="5000" required />
        </FieldRow>
        <FieldRow label="Date" htmlFor="date" className="col-span-2">
          <Input id="date" name="date" type="date" defaultValue={defaultDate} required />
        </FieldRow>
        <FieldRow label="Note" htmlFor="description" className="col-span-2">
          <Input id="description" name="description" placeholder="e.g. June electricity bill" />
        </FieldRow>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Save expense"}
        </Button>
      </div>
    </form>
  );
}
