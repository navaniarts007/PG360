"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PermissionFields } from "@/components/admin/permission-fields";
import { updateStaffPermissionsAction, type ActionState } from "@/lib/actions/staff";
import type { StaffPermissions } from "@/lib/types";

export function StaffPermissionsDialog({
  id,
  name,
  permissions,
}: {
  id: string;
  name: string;
  permissions: StaffPermissions | null;
}) {
  return (
    <Modal
      title={`Privileges · ${name}`}
      description="Choose what this staff member can access and do."
      trigger={(open) => (
        <button
          onClick={open}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-paper-2 hover:text-clay-600"
        >
          <ShieldCheck className="size-3.5" /> Privileges
        </button>
      )}
    >
      {(close) => <Form id={id} permissions={permissions} onDone={close} />}
    </Modal>
  );
}

function Form({
  id,
  permissions,
  onDone,
}: {
  id: string;
  permissions: StaffPermissions | null;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateStaffPermissionsAction,
    {},
  );
  const router = useRouter();
  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onDone();
    }
  }, [state.ok, onDone, router]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <PermissionFields initial={permissions} />
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Save privileges"}
        </Button>
      </div>
    </form>
  );
}
