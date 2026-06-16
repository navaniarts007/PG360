"use client";

import { useState } from "react";
import { ChevronDown, Eye, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

/** A floor as a card you can View (expand) to see its rooms. Server renders the
 *  room cards (+ add-room button) as children; floor edit/delete come via the
 *  `actions` slot. Collapsed by default — you see the floors, then click View. */
export function FloorSection({
  label,
  rooms,
  bedsFilled,
  bedsTotal,
  vacant,
  actions,
  children,
}: {
  label: string;
  rooms: number;
  bedsFilled: number;
  bedsTotal: number;
  vacant: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface/70 shadow-soft">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <span
            className={cn(
              "grid size-9 place-items-center rounded-xl bg-paper-2 text-ink-soft ring-1 ring-line transition-colors",
              open && "bg-clay-50 text-clay-600 ring-clay-100",
            )}
          >
            <Layers className="size-4.5" />
          </span>
          <span>
            <span className="block font-display text-lg font-semibold text-ink">{label}</span>
            <span className="block text-xs text-ink-muted">
              {rooms} {rooms === 1 ? "room" : "rooms"}
              {bedsTotal > 0 && ` · ${bedsFilled}/${bedsTotal} beds filled`}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          {vacant > 0 && (
            <span className="hidden rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 ring-1 ring-rose-100 sm:inline">
              {vacant} vacant
            </span>
          )}
          {actions}
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-paper transition-colors hover:bg-ink-soft"
          >
            <Eye className="size-3.5" />
            {open ? "Hide" : "View"}
            <ChevronDown className={cn("size-3.5 transition-transform duration-300", open && "rotate-180")} />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-line p-4 sm:p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
