"use client";

import { useActionState } from "react";
import { CheckCircle2, Coffee, Loader2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { saveFoodMenuAction, type ActionState } from "@/lib/actions/food";
import { DAY_NAMES, MEALS } from "@/lib/utils";

const MEAL_META = {
  breakfast: { label: "Breakfast", icon: Coffee },
  lunch: { label: "Lunch", icon: Sun },
  dinner: { label: "Dinner", icon: Moon },
} as const;

const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function FoodMenuEditor({ menu }: { menu: Record<string, string> }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveFoodMenuAction,
    {},
  );

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {DAY_NAMES.map((_, day) => (
          <div key={day} className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
            <p className="mb-3 font-display text-lg font-semibold text-ink">{DAY_FULL[day]}</p>
            <div className="space-y-2.5">
              {MEALS.map((meal) => {
                const M = MEAL_META[meal];
                return (
                  <div key={meal}>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                      <M.icon className="size-3.5" /> {M.label}
                    </label>
                    <Input
                      name={`d${day}_${meal}`}
                      defaultValue={menu[`${day}_${meal}`] ?? ""}
                      placeholder="—"
                      className="h-9 text-sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-2xl border border-line bg-paper/90 p-4 shadow-lift backdrop-blur">
        <p className="text-sm text-ink-muted">
          {state.ok ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-teal-600">
              <CheckCircle2 className="size-4" /> Menu saved — tenants can see it now.
            </span>
          ) : (
            "Set the same menu each week; tenants opt in or out per meal."
          )}
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Save menu"}
        </Button>
      </div>
    </form>
  );
}
