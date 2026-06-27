"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Generic confirm-then-delete control. Pass a server action that takes the id
 *  in a FormData field named "id". */
export function ConfirmDelete({
  action,
  id,
  title = "Delete",
  iconOnly = true,
  extra,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  title?: string;
  iconOnly?: boolean;
  /** Extra form fields to submit alongside the id (e.g. tenant_id). */
  extra?: Record<string, string>;
}) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  const run = () =>
    start(() => {
      const fd = new FormData();
      fd.set("id", id);
      for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
      void action(fd);
    });

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="text-ink-muted">Sure?</span>
        <button onClick={() => setConfirm(false)} className="font-medium text-ink-muted hover:text-ink">
          No
        </button>
        <button
          onClick={run}
          disabled={pending}
          className="rounded-lg bg-rose-500 px-2 py-1 font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Delete"}
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg text-ink-muted transition-colors hover:bg-rose-50 hover:text-rose-600",
        iconOnly ? "grid size-8 place-items-center" : "px-2.5 py-1.5 text-xs font-semibold",
      )}
    >
      <Trash2 className="size-4" />
      {!iconOnly && title}
    </button>
  );
}
