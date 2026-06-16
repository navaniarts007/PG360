"use client";

import { useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { setBookingStatusAction } from "@/lib/actions/booking";
import type { BookingStatus } from "@/lib/types";

export function BookingStatusControl({
  id,
  status,
}: {
  id: string;
  status: BookingStatus;
}) {
  const [pending, start] = useTransition();

  const set = (next: BookingStatus) =>
    start(() => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("status", next);
      void setBookingStatusAction(fd);
    });

  if (status !== "pending") {
    return (
      <button
        onClick={() => set("pending")}
        disabled={pending}
        className="text-xs font-medium text-ink-muted hover:text-ink disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Reopen"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => set("rejected")}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
      >
        <X className="size-3.5" /> Reject
      </button>
      <button
        onClick={() => set("approved")}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg bg-teal-500 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Approve
      </button>
    </div>
  );
}
