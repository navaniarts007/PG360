"use client";

import { useFormStatus } from "react-dom";
import { recordRenewalDecisionAction } from "@/lib/actions/renewals";

function SubmitButton({ label, variant }: { label: string; variant: "staying" | "leaving" }) {
  const { pending } = useFormStatus();

  const baseStyle =
    variant === "staying"
      ? "bg-teal-50 text-teal-700 ring-teal-100 hover:bg-teal-100"
      : "bg-rose-50 text-rose-700 ring-rose-100 hover:bg-rose-100";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition-all disabled:opacity-50 ${baseStyle}`}
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

export function RenewalButtons({ tenantId, cycleEnd }: { tenantId: string; cycleEnd: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <form action={recordRenewalDecisionAction}>
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input type="hidden" name="cycle_end" value={cycleEnd} />
        <input type="hidden" name="decision" value="extend" />
        <SubmitButton label="Staying" variant="staying" />
      </form>
      <form action={recordRenewalDecisionAction}>
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input type="hidden" name="cycle_end" value={cycleEnd} />
        <input type="hidden" name="decision" value="vacate" />
        <SubmitButton label="Leaving" variant="leaving" />
      </form>
    </div>
  );
}
