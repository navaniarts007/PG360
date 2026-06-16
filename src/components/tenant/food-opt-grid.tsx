"use client";

import { useState, useTransition } from "react";
import { Coffee, Moon, Sun } from "lucide-react";
import { toggleFoodOptAction } from "@/lib/actions/food";
import { cn } from "@/lib/utils";
import { MEALS, type WeekDay } from "@/lib/utils";

const MEAL_META = {
  breakfast: { label: "Breakfast", icon: Coffee },
  lunch: { label: "Lunch", icon: Sun },
  dinner: { label: "Dinner", icon: Moon },
} as const;

export function FoodOptGrid({
  week,
  menu,
  initialOpts,
}: {
  week: WeekDay[];
  menu: Record<string, string>;
  initialOpts: Record<string, boolean>;
}) {
  const [opts, setOpts] = useState(initialOpts);
  const [, start] = useTransition();

  const isIn = (iso: string, meal: string) => opts[`${iso}_${meal}`] ?? true;

  const toggle = (iso: string, meal: string) => {
    const next = !isIn(iso, meal);
    setOpts((o) => ({ ...o, [`${iso}_${meal}`]: next }));
    start(() => {
      const fd = new FormData();
      fd.set("date", iso);
      fd.set("meal_type", meal);
      fd.set("opted_in", String(next));
      void toggleFoodOptAction(fd);
    });
  };

  return (
    <div className="space-y-3">
      {week.map((d) => (
        <div
          key={d.iso}
          className={cn(
            "rounded-2xl border bg-surface p-4 shadow-soft",
            d.isToday ? "border-clay-300 ring-1 ring-clay-200" : "border-line",
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="font-display text-lg font-semibold text-ink">{d.label}</span>
            <span className="text-sm text-ink-muted tnum">{d.dayNum}</span>
            {d.isToday && (
              <span className="rounded-full bg-clay-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-clay-600">
                Today
              </span>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {MEALS.map((meal) => {
              const M = MEAL_META[meal];
              const desc = menu[`${d.dayIndex}_${meal}`];
              const optedIn = isIn(d.iso, meal);
              return (
                <div key={meal} className="rounded-xl border border-line bg-paper-2/40 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                    <M.icon className="size-3.5" /> {M.label}
                  </div>
                  <p className="mt-1 min-h-[2.5rem] text-sm font-medium text-ink">
                    {desc || <span className="text-ink-muted">Not set</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggle(d.iso, meal)}
                    disabled={!desc}
                    className={cn(
                      "mt-2 w-full rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40",
                      optedIn
                        ? "bg-teal-500 text-white hover:bg-teal-600"
                        : "bg-paper-2 text-ink-muted ring-1 ring-inset ring-line hover:text-ink",
                    )}
                  >
                    {optedIn ? "Eating in ✓" : "Opted out"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
