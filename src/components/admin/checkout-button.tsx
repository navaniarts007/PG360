"use client";

import { useState, useTransition } from "react";
import { DoorOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkoutTenantAction } from "@/lib/actions/admin";

export function CheckoutButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  if (!confirm) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
        <DoorOpen className="size-4" /> Mark checkout
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-ink-muted">Confirm?</span>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
        No
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(() => {
            const fd = new FormData();
            fd.set("id", id);
            void checkoutTenantAction(fd);
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Yes, check out"}
      </Button>
    </div>
  );
}
