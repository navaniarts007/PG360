"use client";

import { useTransition } from "react";
import { Loader2, Utensils } from "lucide-react";
import { tenantToggleFoodAction } from "@/lib/actions/tenant";
import { inr } from "@/lib/utils";

export function FoodPlanToggle({
  optOut,
  deduction,
}: {
  optOut: boolean;
  deduction: number;
}) {
  const [pending, start] = useTransition();
  const included = !optOut;

  const toggle = () =>
    start(() => {
      const fd = new FormData();
      fd.set("opt_out", String(included)); // flipping: if currently included, opt out
      void tenantToggleFoodAction(fd);
    });

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${
            included ? "bg-teal-50 text-teal-600 ring-teal-100" : "bg-paper-2 text-ink-muted ring-line"
          }`}
        >
          <Utensils className="size-5" />
        </span>
        <div>
          <p className="font-semibold text-ink">
            {included ? "Meals included" : "Opted out of meals"}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {included
              ? "Your rent includes the mess food."
              : deduction > 0
                ? `${inr(deduction)} is deducted from your bill each month.`
                : "No food charge on your bill."}
          </p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={pending}
        aria-pressed={included}
        className="relative h-6 w-11 shrink-0 rounded-full bg-line-strong transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-all data-[on=true]:bg-teal-500 data-[on=true]:after:translate-x-5 disabled:opacity-50"
        data-on={included}
      >
        {pending && (
          <Loader2 className="absolute -left-6 top-0.5 size-4 animate-spin text-ink-muted" />
        )}
      </button>
    </div>
  );
}
