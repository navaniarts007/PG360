"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

const DEFAULT_CATEGORIES = [
  "rent",
  "salaries",
  "utilities",
  "groceries",
  "maintenance",
  "supplies",
  "marketing",
  "other",
];

const NEW = "__new__";
const NONE = "__none__";
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

export interface ExpenseCat {
  name: string;
  parent: string; // "" = top-level, else parent category name
}

export function AddExpenseDialog({
  defaultDate,
  expense,
  categories = [],
}: {
  defaultDate: string;
  expense?: Expense;
  /** custom categories + sub-categories defined for this property */
  categories?: ExpenseCat[];
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
        <ExpenseForm
          defaultDate={defaultDate}
          expense={expense}
          categories={categories}
          onDone={close}
        />
      )}
    </Modal>
  );
}

function ExpenseForm({
  defaultDate,
  expense,
  categories,
  onDone,
}: {
  defaultDate: string;
  expense?: Expense;
  categories: ExpenseCat[];
  onDone: () => void;
}) {
  const editing = !!expense;
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    editing ? updateExpenseAction : addExpenseAction,
    {},
  );
  useEffect(() => {
    if (state.ok) {
      router.refresh(); // reflect the new/edited expense in the list immediately
      onDone();
    }
  }, [state.ok, onDone, router]);

  // top-level options (defaults + this property's custom top-level categories)
  const customTop = categories.filter((c) => !c.parent).map((c) => c.name.toLowerCase());
  const options = [...new Set([...DEFAULT_CATEGORIES, ...customTop])];
  const initial: string = expense?.category ?? "utilities";
  // an edited expense may have a category no longer in the list — keep it
  if (initial && !options.includes(initial.toLowerCase())) options.push(initial.toLowerCase());

  const [cat, setCat] = useState<string>(initial);
  const [newCat, setNewCat] = useState("");
  const [sub, setSub] = useState<string>(expense?.subcategory ?? NONE);
  const [newSub, setNewSub] = useState("");

  const effectiveCat = cat === NEW ? newCat : cat;
  const subs = categories
    .filter((c) => c.parent && c.parent.toLowerCase() === effectiveCat.toLowerCase())
    .map((c) => c.name);
  // keep an edited expense's existing sub-category in the list
  if (expense?.subcategory && !subs.some((s) => s.toLowerCase() === expense.subcategory!.toLowerCase())) {
    subs.push(expense.subcategory);
  }
  const subValue = sub === NEW ? newSub : sub === NONE ? "" : sub;

  return (
    <form action={action} className="space-y-4">
      {editing && <input type="hidden" name="id" value={expense!.id} />}
      {/* the values actually submitted (typed names when adding new) */}
      <input type="hidden" name="category" value={effectiveCat} />
      <input type="hidden" name="subcategory" value={subValue} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Category" htmlFor="category_pick">
          <Select
            id="category_pick"
            value={cat}
            onChange={(e) => {
              setCat(e.target.value);
              setSub(NONE); // reset sub-category when the parent changes
            }}
          >
            {options.map((c) => (
              <option key={c} value={c} className="capitalize">
                {cap(c)}
              </option>
            ))}
            <option value={NEW}>+ New category…</option>
          </Select>
        </FieldRow>
        <FieldRow label="Sub-category" htmlFor="subcategory_pick">
          <Select
            id="subcategory_pick"
            value={sub}
            onChange={(e) => setSub(e.target.value)}
          >
            <option value={NONE}>— None —</option>
            {subs.map((sName) => (
              <option key={sName} value={sName} className="capitalize">
                {cap(sName)}
              </option>
            ))}
            <option value={NEW}>+ New sub-category…</option>
          </Select>
        </FieldRow>
        {cat === NEW && (
          <FieldRow label="New category name" htmlFor="category_new" className="col-span-2">
            <Input
              id="category_new"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="e.g. Internet, Repairs, Staff food"
              autoFocus
              required
            />
          </FieldRow>
        )}
        {sub === NEW && (
          <FieldRow label="New sub-category name" htmlFor="subcategory_new" className="col-span-2">
            <Input
              id="subcategory_new"
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              placeholder="e.g. Electricity, Water, Cook salary"
              required
            />
          </FieldRow>
        )}
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
