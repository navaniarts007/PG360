"use client";

import { useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { verifyPaymentAction } from "@/lib/actions/admin";

export function VerifyPaymentButton({ paymentId }: { paymentId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(() => {
          const fd = new FormData();
          fd.set("id", paymentId);
          void verifyPaymentAction(fd);
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      Verify
    </button>
  );
}
