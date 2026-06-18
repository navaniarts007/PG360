"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import {
  addExpenseAction,
  updateExpenseAction,
  type ActionState,
} from "@/lib/actions/admin";
import type { Expense } from "@/lib/types";

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

export function AddExpenseDialog({
  defaultDate,
  expense,
}: {
  defaultDate: string;
  expense?: Expense;
}) {
  const editing = !!expense;
  return (
    <Modal
      title={editing ? "Edit expense" : "Log an expense"}
      description={
        editing
          ? "Update this expense entry."
          : "Track what your PG spends to get an accurate P&L."
      }
      trigger={(open) =>
        editing ? (
          <button
            onClick={open}
            title="Edit expense"
            className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-paper-2 hover:text-clay-600"
          >
            <Pencil className="size-4" />
          </button>
        ) : (
          <Button onClick={open}>
            <Plus className="size-4" /> Add expense
          </Button>
        )
      }
    >
      {(close) => (
        <ExpenseForm defaultDate={defaultDate} expense={expense} onDone={close} />
      )}
    </Modal>
  );
}

function ExpenseForm({
  defaultDate,
  expense,
  onDone,
}: {
  defaultDate: string;
  expense?: Expense;
  onDone: () => void;
}) {
  const editing = !!expense;
  const [state, action, pending] = useActionState<ActionState, FormData>(
    editing ? updateExpenseAction : addExpenseAction,
    {},
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="space-y-4">
      {editing && <input type="hidden" name="id" value={expense!.id} />}
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Category" htmlFor="category">
          <Select
            id="category"
            name="category"
            defaultValue={expense?.category ?? "utilities"}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c[0]!.toUpperCase() + c.slice(1)}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Amount (₹)" htmlFor="amount">
          <Input
            id="amount"
            name="amount"
            type="number"
            min={0}
            placeholder="5000"
            defaultValue={expense?.amount ?? ""}
            required
          />
        </FieldRow>
        <FieldRow label="Date" htmlFor="date" className="col-span-2">
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={expense?.date ?? defaultDate}
            required
          />
        </FieldRow>
        <FieldRow label="Note" htmlFor="description" className="col-span-2">
          <Input
            id="description"
            name="description"
            placeholder="e.g. June electricity bill"
            defaultValue={expense?.description ?? ""}
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
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : editing ? (
            "Save changes"
          ) : (
            "Save expense"
          )}
        </Button>
      </div>
    </form>
  );
}
