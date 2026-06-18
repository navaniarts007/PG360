"use client";

import { useState, useTransition } from "react";
import { BellRing, Check, Loader2 } from "lucide-react";
import { remindTenantAction } from "@/lib/actions/admin";

/** Sends a tenant an in-app rent reminder. Shows a brief "Sent" state after. */
export function RemindButton({
  tenantId,
  month,
  balance,
}: {
  tenantId: string;
  month: string;
  balance: number;
}) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  const send = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("tenant_id", tenantId);
      fd.set("month", month);
      fd.set("balance", String(balance));
      await remindTenantAction(fd);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    });

  return (
    <button
      onClick={send}
      disabled={pending || sent}
      title="Send rent reminder"
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-paper-2 hover:text-clay-600 disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : sent ? (
        <Check className="size-3.5 text-teal-600" />
      ) : (
        <BellRing className="size-3.5" />
      )}
      {sent ? "Sent" : "Remind"}
    </button>
  );
}
