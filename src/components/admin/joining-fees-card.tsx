"use client";

import { useTransition } from "react";
import { BadgeCheck, Loader2, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toggleJoiningFeePaidAction } from "@/lib/actions/admin";
import { inr } from "@/lib/utils";
import type { JoiningFee } from "@/lib/types";

export function JoiningFeesCard({
  fees,
  tenantId,
}: {
  fees: JoiningFee[];
  tenantId: string;
}) {
  if (fees.length === 0) return null;
  return (
    <Card className="p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-lg text-ink">
        <Receipt className="size-4 text-ink-muted" /> Joining fees
      </h3>
      <div className="mt-4 space-y-3">
        {fees.map((f) => (
          <FeeRow key={f.id} fee={f} tenantId={tenantId} />
        ))}
      </div>
    </Card>
  );
}

function FeeRow({ fee, tenantId }: { fee: JoiningFee; tenantId: string }) {
  const [pending, start] = useTransition();
  const toggle = () =>
    start(() => {
      const fd = new FormData();
      fd.set("id", fee.id);
      fd.set("tenant_id", tenantId);
      fd.set("paid", String(!fee.paid));
      void toggleJoiningFeePaidAction(fd);
    });

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-3 text-sm last:border-0">
      <div>
        <p className="font-medium text-ink">{fee.description}</p>
        <p className="text-xs text-ink-muted tnum">{inr(fee.amount)}</p>
      </div>
      <button
        onClick={toggle}
        disabled={pending}
        className={
          fee.paid
            ? "inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-100 disabled:opacity-50"
            : "inline-flex items-center gap-1.5 rounded-lg bg-clay-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-clay-700 disabled:opacity-50"
        }
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : fee.paid ? (
          <BadgeCheck className="size-3.5" />
        ) : null}
        {fee.paid ? "Paid" : "Mark paid"}
      </button>
    </div>
  );
}
