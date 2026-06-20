"use client";

import { useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { rejectPaymentAction, verifyPaymentAction } from "@/lib/actions/admin";

/** Confirm or reject a tenant-submitted payment awaiting the owner's review. */
export function VerifyRejectButtons({ paymentId }: { paymentId: string }) {
  const [pending, start] = useTransition();

  const run = (action: (fd: FormData) => Promise<void>) =>
    start(() => {
      const fd = new FormData();
      fd.set("id", paymentId);
      void action(fd);
    });

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={() => run(rejectPaymentAction)}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
      >
        <X className="size-3.5" /> Reject
      </button>
      <button
        onClick={() => run(verifyPaymentAction)}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-lg bg-teal-500 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Verify
      </button>
    </div>
  );
}
