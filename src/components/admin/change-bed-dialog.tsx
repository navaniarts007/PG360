"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BedDouble, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Select } from "@/components/ui/field";
import { updateTenantAction, type ActionState } from "@/lib/actions/admin";
import type { BedOption } from "@/lib/db";
import type { Tenant } from "@/lib/types";

/** A compact dialog to change just the room / bed of an existing tenant without
 *  going through the full Edit Tenant form. */
export function ChangeBedDialog({
  tenant,
  beds,
}: {
  tenant: Tenant;
  beds: BedOption[];
}) {
  return (
    <Modal
      title="Change room / bed"
      description="Pick a different bed for this tenant. Rent will update to the bed's listed rate."
      trigger={(open) => (
        <button
          onClick={open}
          className="inline-flex items-center gap-1.5 rounded-lg border border-clay-200 bg-clay-50 px-3 py-1.5 text-xs font-semibold text-clay-700 transition-colors hover:bg-clay-100"
        >
          <BedDouble className="size-3.5" />
          Change bed
        </button>
      )}
    >
      {(close) => <BedForm tenant={tenant} beds={beds} onDone={close} />}
    </Modal>
  );
}

function BedForm({
  tenant,
  beds,
  onDone,
}: {
  tenant: Tenant;
  beds: BedOption[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateTenantAction,
    {},
  );
  const [bedId, setBedId] = useState(tenant.bed_id ?? "none");
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onDone();
    }
  }, [state.ok, onDone, router]);

  // Show all vacant beds + the tenant's current bed (even if occupied by them)
  const options = beds.filter(
    (b) => b.status === "vacant" || b.id === tenant.bed_id,
  );

  const selectedBed = beds.find((b) => b.id === bedId);

  return (
    <form action={action} className="space-y-4">
      {/* Pass through all the fields updateTenantAction expects */}
      <input type="hidden" name="id" value={tenant.id} />
      <input type="hidden" name="name" value={tenant.name} />
      <input type="hidden" name="phone" value={tenant.phone} />
      <input type="hidden" name="parent_phone" value={tenant.parent_phone ?? ""} />
      <input type="hidden" name="guardian" value={tenant.guardian ?? ""} />
      <input type="hidden" name="vehicle_number" value={tenant.vehicle_number ?? ""} />
      <input type="hidden" name="address" value={tenant.address ?? ""} />
      <input type="hidden" name="occupation" value={tenant.occupation ?? ""} />
      <input type="hidden" name="organization" value={tenant.organization ?? ""} />
      <input type="hidden" name="email" value={tenant.email ?? ""} />
      <input type="hidden" name="aadhaar_number" value={tenant.aadhaar_number ?? ""} />
      <input type="hidden" name="security_deposit" value={tenant.security_deposit} />
      <input type="hidden" name="rent_due_day" value={tenant.rent_due_day} />
      <input type="hidden" name="avatar_url" value={tenant.avatar_url ?? ""} />
      <input type="hidden" name="aadhaar_photo_url" value={tenant.aadhaar_photo_url ?? ""} />
      <input type="hidden" name="stay_type" value={tenant.stay_type ?? "monthly"} />
      {tenant.stay_type === "daily" && (
        <>
          <input type="hidden" name="daily_rate" value={tenant.daily_rate ?? ""} />
          <input type="hidden" name="stay_days" value={tenant.stay_days ?? ""} />
        </>
      )}
      {tenant.checkin_date && (
        <input type="hidden" name="checkin_date" value={tenant.checkin_date.slice(0, 10)} />
      )}

      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <FieldRow label="Bed" htmlFor="bed_id" hint="vacant beds only">
        <Select
          id="bed_id"
          name="bed_id"
          value={bedId}
          onChange={(e) => setBedId(e.target.value)}
        >
          <option value="none">Unassigned</option>
          {options.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
              {b.id === tenant.bed_id ? " (current)" : ""}
            </option>
          ))}
        </Select>
      </FieldRow>

      {/* Show a preview of the new rent */}
      {selectedBed && bedId !== "none" && bedId !== tenant.bed_id && (
        <div className="rounded-xl border border-clay-100 bg-clay-50/50 px-4 py-3">
          <p className="text-xs font-semibold text-clay-700">
            New monthly rent: ₹{selectedBed.price.toLocaleString("en-IN")}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            This will replace the current rent of ₹{tenant.rent_amount.toLocaleString("en-IN")}
          </p>
        </div>
      )}

      {/* rent_amount hidden — let the bed price set it, or keep current if same bed */}
      <input
        type="hidden"
        name="rent_amount"
        value={selectedBed ? selectedBed.price : tenant.rent_amount}
      />

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? (
            <><Loader2 className="size-4 animate-spin" /> Saving…</>
          ) : (
            "Save bed change"
          )}
        </Button>
      </div>
    </form>
  );
}
