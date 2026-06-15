"use client";

import { useTransition } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { togglePgStatusAction } from "@/lib/actions/platform";
import { cn } from "@/lib/utils";
import type { PgStatus } from "@/lib/types";

export function PgStatusToggle({ id, status }: { id: string; status: PgStatus }) {
  const [pending, start] = useTransition();
  const active = status === "active";

  return (
    <button
      onClick={() =>
        start(() => {
          const fd = new FormData();
          fd.set("id", id);
          void togglePgStatusAction(fd);
        })
      }
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
        active
          ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
          : "bg-teal-50 text-teal-700 hover:bg-teal-100",
      )}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : active ? (
        <Pause className="size-3.5" />
      ) : (
        <Play className="size-3.5" />
      )}
      {active ? "Suspend" : "Activate"}
    </button>
  );
}
