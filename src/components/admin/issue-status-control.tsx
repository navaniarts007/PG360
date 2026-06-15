"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setIssueStatusAction } from "@/lib/actions/admin";
import { cn } from "@/lib/utils";
import type { IssueStatus } from "@/lib/types";

const OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

export function IssueStatusControl({
  id,
  status,
}: {
  id: string;
  status: IssueStatus;
}) {
  const [pending, start] = useTransition();

  const set = (value: IssueStatus) => {
    if (value === status) return;
    start(() => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("status", value);
      void setIssueStatusAction(fd);
    });
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-paper-2/50 p-1">
      {pending && <Loader2 className="ml-1 size-3.5 animate-spin text-ink-muted" />}
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => set(o.value)}
          disabled={pending}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60",
            status === o.value
              ? o.value === "resolved"
                ? "bg-teal-500 text-white"
                : o.value === "in_progress"
                  ? "bg-gold-400 text-ink"
                  : "bg-rose-500 text-white"
              : "text-ink-muted hover:bg-surface hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
