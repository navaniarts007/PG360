"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Trash2 } from "lucide-react";
import {
  deletePropertyAction,
  setActivePropertyAction,
} from "@/lib/actions/property";

export function PropertyControls({
  propertyId,
  isActive,
  canDelete,
}: {
  propertyId: string;
  isActive: boolean;
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();

  const switchTo = () =>
    start(async () => {
      await setActivePropertyAction(propertyId);
      router.refresh();
    });

  const remove = () =>
    start(() => {
      const fd = new FormData();
      fd.set("id", propertyId);
      void deletePropertyAction(fd);
    });

  return (
    <div className="flex items-center gap-2">
      {isActive ? (
        <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-100">
          <Check className="size-3.5" /> Active
        </span>
      ) : (
        <button
          onClick={switchTo}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-clay-50 px-2.5 py-1.5 text-xs font-semibold text-clay-700 transition-colors hover:bg-clay-100 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} Switch to
        </button>
      )}
      {canDelete &&
        (confirm ? (
          <span className="flex items-center gap-1.5 text-xs">
            <button onClick={() => setConfirm(false)} className="text-ink-muted hover:text-ink">
              No
            </button>
            <button
              onClick={remove}
              disabled={pending}
              className="rounded-lg bg-rose-500 px-2 py-1 font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Delete"}
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            title="Delete property"
            className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="size-4" />
          </button>
        ))}
    </div>
  );
}
