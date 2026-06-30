"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { AlertCircle, Loader2, Plus, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/field";
import {
  addExpenseCategoryAction,
  deleteExpenseCategoryAction,
  type ActionState,
} from "@/lib/actions/admin";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Master list for custom expense categories — add new ones, remove the ones
 *  you don't use. The built-in defaults are always available and not listed. */
export function ExpenseCategoriesDialog({ categories }: { categories: string[] }) {
  return (
    <Modal
      title="Expense categories"
      description="Add your own categories (e.g. Internet, Repairs). They appear when logging an expense."
      trigger={(open) => (
        <Button variant="outline" onClick={open}>
          <Tags className="size-4" /> Categories
        </Button>
      )}
    >
      {() => <CategoryManager categories={categories} />}
    </Modal>
  );
}

function CategoryManager({ categories }: { categories: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addExpenseCategoryAction,
    {},
  );
  const [name, setName] = useState("");
  const [removing, startRemove] = useTransition();

  useEffect(() => {
    if (state.ok) setName("");
  }, [state.ok]);

  const remove = (cat: string) =>
    startRemove(() => {
      const fd = new FormData();
      fd.set("name", cat);
      void deleteExpenseCategoryAction(fd);
    });

  return (
    <div className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <form action={action} className="flex gap-2">
        <Input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
        </Button>
      </form>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Your categories
        </p>
        {categories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-ink-muted">
            No custom categories yet — the built-in ones (Rent, Salaries, Utilities…) are always available.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {categories.map((c) => (
              <li key={c} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                <span className="font-medium text-ink">{cap(c)}</span>
                <button
                  onClick={() => remove(c)}
                  disabled={removing}
                  title="Remove category"
                  className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
