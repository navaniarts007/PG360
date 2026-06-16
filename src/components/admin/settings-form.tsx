"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveSettingsAction } from "@/lib/actions/property";
import type { PropertySettings } from "@/lib/types";

const MODULES: {
  key: keyof PropertySettings;
  label: string;
  desc: string;
  live: boolean;
}[] = [
  { key: "food", label: "Food & mess", desc: "Weekly menu + meal opt in/out", live: true },
  { key: "bookings", label: "Booking requests", desc: "Public room-request inbox", live: true },
  { key: "complaints", label: "Complaints", desc: "Tenant issue tracking", live: true },
  { key: "electricity", label: "Electricity billing", desc: "Per-tenant electricity charges", live: false },
  { key: "daily_stay", label: "Daily / package stays", desc: "Short-term stay pricing", live: false },
  { key: "reviews", label: "Reviews & feedback", desc: "Tenant reviews + moderation", live: false },
  { key: "visitors", label: "Visitor management", desc: "Log visitor check-ins", live: false },
];

export function SettingsForm({ settings }: { settings: PropertySettings }) {
  const [state, action, pending] = useActionState(saveSettingsAction, {});

  return (
    <form action={action} className="space-y-5">
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {MODULES.map((m) => {
          const on = m.live ? settings[m.key] !== false : settings[m.key] === true;
          return (
            <label
              key={m.key}
              className="flex cursor-pointer items-center justify-between gap-4 p-4 sm:px-6"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink">{m.label}</p>
                  {!m.live && <Badge tone="neutral">Coming soon</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{m.desc}</p>
              </div>
              <input
                type="checkbox"
                name={m.key}
                defaultChecked={on}
                disabled={!m.live}
                className="peer sr-only"
              />
              <div className="relative h-6 w-11 shrink-0 rounded-full bg-line-strong transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-teal-500 peer-checked:after:translate-x-5 peer-disabled:opacity-40" />
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          {state.ok ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-teal-600">
              <CheckCircle2 className="size-4" /> Saved — navigation updates instantly.
            </span>
          ) : state.error ? (
            <span className="text-rose-600">{state.error}</span>
          ) : (
            "Turn modules on or off for this property."
          )}
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Save modules"}
        </Button>
      </div>
    </form>
  );
}
