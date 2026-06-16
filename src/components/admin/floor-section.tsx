"use client";

import { useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

/** Collapsible floor group. Server renders the room cards as children; this
 *  client wrapper just handles expand/minimize with a smooth height animation. */
export function FloorSection({
  label,
  rooms,
  bedsFilled,
  bedsTotal,
  vacant,
  defaultOpen = false,
  children,
}: {
  label: string;
  rooms: number;
  bedsFilled: number;
  bedsTotal: number;
  vacant: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface/70 shadow-soft">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-paper-2/40 sm:px-5"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid size-9 place-items-center rounded-xl bg-paper-2 text-ink-soft ring-1 ring-line transition-colors",
              open && "bg-clay-50 text-clay-600 ring-clay-100",
            )}
          >
            <Layers className="size-4.5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-ink">{label}</p>
            <p className="text-xs text-ink-muted">
              {rooms} {rooms === 1 ? "room" : "rooms"} · {bedsFilled}/{bedsTotal} beds filled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {vacant > 0 ? (
            <span className="hidden rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 ring-1 ring-rose-100 sm:inline">
              {vacant} vacant
            </span>
          ) : (
            <span className="hidden rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-100 sm:inline">
              Full
            </span>
          )}
          <ChevronDown
            className={cn(
              "size-5 text-ink-muted transition-transform duration-300",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      <div
        className={cn(
          "grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="grid gap-4 border-t border-line p-4 sm:p-5 lg:grid-cols-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
