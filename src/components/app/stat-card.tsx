import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "clay" | "teal" | "gold" | "rose" | "ink";

const accents: Record<Accent, { icon: string; bar: string }> = {
  clay: { icon: "bg-clay-50 text-clay-600 ring-clay-100", bar: "bg-clay-400" },
  teal: { icon: "bg-teal-50 text-teal-600 ring-teal-100", bar: "bg-teal-400" },
  gold: { icon: "bg-gold-50 text-gold-600 ring-gold-100", bar: "bg-gold-400" },
  rose: { icon: "bg-rose-50 text-rose-600 ring-rose-100", bar: "bg-rose-400" },
  ink: { icon: "bg-paper-2 text-ink ring-line", bar: "bg-ink" },
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "clay",
  progress,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: Accent;
  progress?: number;
}) {
  const a = accents[accent];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-xl ring-1 ring-inset",
            a.icon,
          )}
        >
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-ink tnum">{value}</p>
      <p className="mt-1 text-sm font-medium text-ink-soft">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-2">
          <div
            className={cn("h-full rounded-full transition-all", a.bar)}
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
