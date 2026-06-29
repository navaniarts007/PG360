"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { updateAccountAction, type ActionState } from "@/lib/actions/platform";
import type { PgAccount } from "@/lib/types";

export function EditAccountDialog({ account }: { account: PgAccount }) {
  return (
    <Modal
      title="Edit account & access"
      description="Update the owner's details and control which edition they get."
      trigger={(open) => (
        <Button variant="outline" onClick={open}>
          <Pencil className="size-4" /> Edit account
        </Button>
      )}
    >
      {(close) => <EditForm account={account} onDone={close} />}
    </Modal>
  );
}

function EditForm({ account, onDone }: { account: PgAccount; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateAccountAction,
    {},
  );
  const [edition, setEdition] = useState<PgAccount["edition"]>(account.edition);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <input type="hidden" name="id" value={account.id} />

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Owner name" htmlFor="owner_name">
          <Input id="owner_name" name="owner_name" defaultValue={account.owner_name} required />
        </FieldRow>
        <FieldRow label="Mobile" htmlFor="mobile">
          <Input id="mobile" name="mobile" defaultValue={account.mobile} required />
        </FieldRow>
        <FieldRow label="Location" htmlFor="location" className="col-span-2">
          <Input id="location" name="location" defaultValue={account.location} required />
        </FieldRow>
        <FieldRow label="Plan" htmlFor="subscription_plan" className="col-span-2">
          <Select id="subscription_plan" name="subscription_plan" defaultValue={account.subscription_plan}>
            <option value="starter">Starter — ₹5,000/yr</option>
            <option value="pro">Pro — ₹8,000/yr</option>
            <option value="lifetime">Lifetime — ₹10,000</option>
          </Select>
        </FieldRow>
      </div>

      <div className="rounded-xl border border-line bg-paper-2/50 p-4 space-y-3">
        <p className="text-sm font-semibold text-ink">Edition &amp; access</p>
        <FieldRow label="Edition" htmlFor="edition">
          <Select
            id="edition"
            name="edition"
            value={edition}
            onChange={(e) => setEdition(e.target.value as PgAccount["edition"])}
          >
            <option value="full">Full — standard PG360 (all modules + tenant portal)</option>
            <option value="gvm">Stripped — owner-only records edition (like GVR Comforts)</option>
          </Select>
        </FieldRow>

        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            name="portal_enabled"
            defaultChecked={account.portal_enabled}
            className="size-4 rounded border-line text-clay-600 focus:ring-clay-500"
          />
          Tenant portal enabled (tenants can log in)
        </label>

        <FieldRow label="Reg-no prefix (optional)" htmlFor="reg_prefix">
          <Input
            id="reg_prefix"
            name="reg_prefix"
            defaultValue={account.reg_prefix ?? ""}
            placeholder="e.g. GVR → GVR-0001"
          />
        </FieldRow>
      </div>

      <div className="rounded-xl border border-line bg-paper-2/50 p-4 space-y-3">
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input
            type="checkbox"
            name="is_demo"
            defaultChecked={account.is_demo}
            className="size-4 rounded border-line text-clay-600 focus:ring-clay-500"
          />
          Demo / trial account (excluded from revenue; expires after the trial)
        </label>
        <FieldRow label="Reset trial / extend by (days)" htmlFor="trial_days" hint="leave blank to keep the current expiry">
          <Input id="trial_days" name="trial_days" type="number" min={1} max={365} placeholder="e.g. 14" />
        </FieldRow>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}
