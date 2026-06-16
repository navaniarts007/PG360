"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { setActivePropertyAction } from "@/lib/actions/property";
import { cn } from "@/lib/utils";
import type { PropertyRef } from "@/lib/types";

export function PropertySwitcher({
  properties,
  activeId,
}: {
  properties: PropertyRef[];
  activeId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const active = properties.find((p) => p.id === activeId) ?? properties[0];

  const pick = (id: string) => {
    setOpen(false);
    if (id === activeId) return;
    start(async () => {
      await setActivePropertyAction(id);
      router.refresh();
    });
  };

  return (
    <div className="relative mx-3 mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-paper-2/60 px-3 py-2.5 text-left transition-colors hover:border-clay-200"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-clay-500 text-paper">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-clay-500">
            Property
          </span>
          <span className="block truncate text-sm font-medium text-ink">
            {active?.name ?? "Select"}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-muted" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-line bg-paper shadow-pop">
            <div className="max-h-64 overflow-y-auto p-1">
              {properties.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pick(p.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-paper-2",
                    p.id === active?.id ? "font-semibold text-ink" : "text-ink-soft",
                  )}
                >
                  <span className="truncate">{p.name}</span>
                  {p.id === active?.id && <Check className="size-4 shrink-0 text-clay-600" />}
                </button>
              ))}
            </div>
            <Link
              href="/dashboard/properties"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 border-t border-line px-3 py-2.5 text-sm font-medium text-clay-600 hover:bg-paper-2"
            >
              <Plus className="size-4" /> Manage properties
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
