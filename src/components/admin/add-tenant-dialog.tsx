"use client";

import { useActionState, useEffect } from "react";
import { AlertCircle, Loader2, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import {
  addTenantAction,
  updateTenantAction,
  type ActionState,
} from "@/lib/actions/admin";
import type { Tenant } from "@/lib/types";

export interface RoomOption {
  id: string;
  label: string;
  full: boolean;
}

export function AddTenantDialog({
  rooms,
  tenant,
}: {
  rooms: RoomOption[];
  tenant?: Tenant;
}) {
  const isEdit = !!tenant;
  return (
    <Modal
      title={isEdit ? `Edit ${tenant.name}` : "Add a tenant"}
      description={
        isEdit
          ? "Update this tenant's details."
          : "Creates the resident and their own login automatically."
      }
      trigger={(open) =>
        isEdit ? (
          <button
            onClick={open}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-paper-2 hover:text-clay-600"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
        ) : (
          <Button onClick={open}>
            <UserPlus className="size-4" /> Add tenant
          </Button>
        )
      }
    >
      {(close) => <TenantForm rooms={rooms} tenant={tenant} onDone={close} />}
    </Modal>
  );
}

function TenantForm({
  rooms,
  tenant,
  onDone,
}: {
  rooms: RoomOption[];
  tenant?: Tenant;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    tenant ? updateTenantAction : addTenantAction,
    {},
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="space-y-4">
      {tenant && <input type="hidden" name="id" value={tenant.id} />}
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Full name" htmlFor="name" className="col-span-2">
          <Input id="name" name="name" defaultValue={tenant?.name ?? ""} placeholder="Arjun Nair" required />
        </FieldRow>
        <FieldRow label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={tenant?.phone ?? ""} placeholder="+9198…" required />
        </FieldRow>
        <FieldRow label="Aadhaar (last 4)" htmlFor="aadhaar_number">
          <Input id="aadhaar_number" name="aadhaar_number" defaultValue={tenant?.aadhaar_number ?? ""} placeholder="XXXX-XXXX-1234" />
        </FieldRow>
        <FieldRow label="Room" htmlFor="room_id">
          <Select id="room_id" name="room_id" defaultValue={tenant?.room_id ?? "none"}>
            <option value="none">Unassigned</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id} disabled={r.full && r.id !== tenant?.room_id}>
                {r.label}
                {r.full && r.id !== tenant?.room_id ? " (full)" : ""}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Rent / month (₹)" htmlFor="rent_amount">
          <Input id="rent_amount" name="rent_amount" type="number" min={0} defaultValue={tenant?.rent_amount ?? ""} placeholder="12000" required />
        </FieldRow>
        <FieldRow label="Security deposit (₹)" htmlFor="security_deposit">
          <Input id="security_deposit" name="security_deposit" type="number" min={0} defaultValue={tenant?.security_deposit ?? ""} placeholder="24000" required />
        </FieldRow>
        <FieldRow label="Rent due day" htmlFor="rent_due_day">
          <Input id="rent_due_day" name="rent_due_day" type="number" min={1} max={28} defaultValue={tenant?.rent_due_day ?? 5} />
        </FieldRow>
        {!tenant && (
          <FieldRow label="Check-in date" htmlFor="checkin_date">
            <Input id="checkin_date" name="checkin_date" type="date" required />
          </FieldRow>
        )}
      </div>

      {!tenant && (
        <div className="rounded-xl border border-line bg-paper-2/50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Tenant login
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Login email" htmlFor="email">
              <Input id="email" name="email" type="email" placeholder="arjun@tenant.in" required />
            </FieldRow>
            <FieldRow label="Password" htmlFor="login_password">
              <Input id="login_password" name="login_password" type="text" placeholder="min 6 chars" required />
            </FieldRow>
          </div>
        </div>
      )}
      {tenant && (
        <FieldRow label="Login email" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={tenant.email} required />
        </FieldRow>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? (
            <><Loader2 className="size-4 animate-spin" /> Saving…</>
          ) : tenant ? (
            "Save changes"
          ) : (
            "Add tenant"
          )}
        </Button>
      </div>
    </form>
  );
}
