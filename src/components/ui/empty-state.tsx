import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="dotgrid flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface/40 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-paper-2 text-ink-muted ring-1 ring-line">
        <Icon className="size-6" />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
