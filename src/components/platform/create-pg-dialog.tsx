"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, Building2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { createPgAction, type ActionState } from "@/lib/actions/platform";

export function CreatePgDialog() {
  return (
    <Modal
      title="Create a PG account"
      description="This provisions the PG and the owner's admin login."
      trigger={(open) => (
        <Button onClick={open}>
          <Plus className="size-4" /> New PG
        </Button>
      )}
    >
      {(close) => <CreatePgForm onDone={close} />}
    </Modal>
  );
}

function CreatePgForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createPgAction,
    {},
  );

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

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="PG name" htmlFor="pg_name" className="col-span-2">
          <Input id="pg_name" name="pg_name" placeholder="Sunrise Stay" required />
        </FieldRow>
        <FieldRow label="Owner name" htmlFor="owner_name">
          <Input id="owner_name" name="owner_name" placeholder="Ravi Kumar" required />
        </FieldRow>
        <FieldRow label="Mobile" htmlFor="mobile">
          <Input id="mobile" name="mobile" placeholder="+9198…" required />
        </FieldRow>
        <FieldRow label="Location" htmlFor="location" className="col-span-2">
          <Input id="location" name="location" placeholder="Koramangala, Bengaluru" required />
        </FieldRow>
        <FieldRow label="Type" htmlFor="pg_type">
          <Select id="pg_type" name="pg_type" defaultValue="coliving">
            <option value="boys">Boys</option>
            <option value="girls">Girls</option>
            <option value="coliving">Co-living</option>
          </Select>
        </FieldRow>
        <FieldRow label="Category" htmlFor="category">
          <Select id="category" name="category" defaultValue="standard">
            <option value="budget">Budget</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </Select>
        </FieldRow>
        <FieldRow label="Plan" htmlFor="subscription_plan" className="col-span-2">
          <Select id="subscription_plan" name="subscription_plan" defaultValue="pro">
            <option value="starter">Starter — ₹5,000/yr</option>
            <option value="pro">Pro — ₹8,000/yr</option>
            <option value="lifetime">Lifetime — ₹10,000</option>
          </Select>
        </FieldRow>
        <FieldRow label="Edition" htmlFor="edition">
          <Select id="edition" name="edition" defaultValue="full">
            <option value="full">Full — all modules + portal</option>
            <option value="gvm">Stripped — owner-only records</option>
          </Select>
        </FieldRow>
        <FieldRow label="Reg-no prefix" htmlFor="reg_prefix">
          <Input id="reg_prefix" name="reg_prefix" placeholder="optional, e.g. GVR" />
        </FieldRow>
      </div>

      <div className="rounded-xl border border-line bg-paper-2/50 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <Building2 className="size-4 text-clay-500" /> Owner login
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Email" htmlFor="owner_email">
            <Input id="owner_email" name="owner_email" type="email" placeholder="ravi@pg.in" required />
          </FieldRow>
          <FieldRow label="Password" htmlFor="owner_password">
            <Input id="owner_password" name="owner_password" type="text" placeholder="min 6 chars" required />
          </FieldRow>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Creating…
            </>
          ) : (
            "Create PG"
          )}
        </Button>
      </div>
    </form>
  );
}
