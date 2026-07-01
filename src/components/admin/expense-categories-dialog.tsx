"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronDown, ChevronRight, Loader2, Plus, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/field";
import {
  addExpenseCategoryAction,
  deleteExpenseCategoryAction,
} from "@/lib/actions/admin";
import type { ExpenseCat } from "@/components/admin/add-expense-dialog";

const DEFAULTS = [
  "rent",
  "salaries",
  "utilities",
  "groceries",
  "maintenance",
  "supplies",
  "marketing",
  "other",
];
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Master list for expense categories and their sub-categories. */
export function ExpenseCategoriesDialog({ categories }: { categories: ExpenseCat[] }) {
  return (
    <Modal
      title="Expense categories"
      description="Add your own categories and sub-categories (e.g. Utilities → Electricity, Water)."
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

function CategoryManager({ categories }: { categories: ExpenseCat[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newTop, setNewTop] = useState("");

  const customTop = categories.filter((c) => !c.parent).map((c) => c.name.toLowerCase());
  const topLevel = [...new Set([...DEFAULTS, ...customTop])];
  const isCustom = (name: string) => customTop.includes(name.toLowerCase());
  const subsOf = (name: string) =>
    categories.filter((c) => c.parent && c.parent.toLowerCase() === name.toLowerCase()).map((c) => c.name);

  const add = (name: string, parent: string, after?: () => void) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("name", trimmed);
      fd.set("parent", parent);
      const res = await addExpenseCategoryAction({}, fd);
      if (res.error) setError(res.error);
      else {
        after?.();
        router.refresh();
      }
    });
  };

  const remove = (name: string, parent: string) => {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("name", name);
      fd.set("parent", parent);
      await deleteExpenseCategoryAction(fd);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {/* add a top-level category */}
      <div className="flex gap-2">
        <Input
          value={newTop}
          onChange={(e) => setNewTop(e.target.value)}
          placeholder="New category name"
        />
        <Button type="button" disabled={pending} onClick={() => add(newTop, "", () => setNewTop(""))}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add
        </Button>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Categories &amp; sub-categories
        </p>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {topLevel.map((c) => (
            <CategoryRow
              key={c}
              name={c}
              custom={isCustom(c)}
              subs={subsOf(c)}
              pending={pending}
              onAddSub={(n, after) => add(n, c, after)}
              onRemoveSub={(n) => remove(n, c)}
              onRemoveSelf={() => remove(c, "")}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function CategoryRow({
  name,
  custom,
  subs,
  pending,
  onAddSub,
  onRemoveSub,
  onRemoveSelf,
}: {
  name: string;
  custom: boolean;
  subs: string[];
  pending: boolean;
  onAddSub: (name: string, after: () => void) => void;
  onRemoveSub: (name: string) => void;
  onRemoveSelf: () => void;
}) {
  const [open, setOpen] = useState(subs.length > 0);
  const [newSub, setNewSub] = useState("");

  return (
    <li className="px-3.5 py-2.5 text-sm">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 font-medium text-ink"
        >
          {open ? <ChevronDown className="size-4 text-ink-muted" /> : <ChevronRight className="size-4 text-ink-muted" />}
          {cap(name)}
          {subs.length > 0 && <span className="text-xs text-ink-muted">· {subs.length}</span>}
          {!custom && <span className="rounded bg-paper-2 px-1.5 py-0.5 text-[0.6rem] font-semibold text-ink-muted">built-in</span>}
        </button>
        {custom && (
          <button
            type="button"
            onClick={onRemoveSelf}
            disabled={pending}
            title="Remove category"
            className="grid size-7 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 space-y-1.5 pl-5">
          {subs.map((sName) => (
            <div key={sName} className="flex items-center justify-between rounded-lg bg-paper-2/50 px-2.5 py-1.5">
              <span className="text-ink-soft">{cap(sName)}</span>
              <button
                type="button"
                onClick={() => onRemoveSub(sName)}
                disabled={pending}
                title="Remove sub-category"
                className="grid size-6 place-items-center rounded text-ink-muted transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              placeholder={`Add sub-category to ${cap(name)}`}
              className="h-9 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onAddSub(newSub, () => setNewSub(""))}
            >
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
