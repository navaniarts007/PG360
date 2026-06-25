"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, IndianRupee, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { recordPaymentAction, type ActionState } from "@/lib/actions/admin";
import { inr } from "@/lib/utils";

export interface PayTenant {
  id: string;
  name: string;
  rent_amount: number;
  room_label: string;
}

export function RecordPaymentDialog({
  tenants,
  month,
  preselectId,
  variant = "primary",
}: {
  tenants: PayTenant[];
  month: string;
  preselectId?: string;
  /** "primary" = full button, "collect" = compact chip (used in tables/lists). */
  variant?: "primary" | "collect";
}) {
  return (
    <Modal
      title="Record a payment"
      description="Build the bill, take the amount paid — status is set automatically."
      trigger={(open) =>
        variant === "collect" ? (
          <button
            onClick={open}
            className="rounded-lg bg-clay-50 px-3 py-1.5 text-xs font-semibold text-clay-700 transition-colors hover:bg-clay-100"
          >
            Collect
          </button>
        ) : (
          <Button onClick={open}>
            <Receipt className="size-4" /> Record payment
          </Button>
        )
      }
    >
      {(close) => (
        <PaymentForm
          tenants={tenants}
          month={month}
          preselectId={preselectId}
          onDone={close}
        />
      )}
    </Modal>
  );
}

function PaymentForm({
  tenants,
  month,
  preselectId,
  onDone,
}: {
  tenants: PayTenant[];
  month: string;
  preselectId?: string;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    recordPaymentAction,
    {},
  );
  const first = preselectId ?? tenants[0]?.id ?? "";
  const [tenantId, setTenantId] = useState(first);
  const selected = tenants.find((t) => t.id === tenantId);

  const [rent, setRent] = useState(selected?.rent_amount ?? 0);
  const [power, setPower] = useState(0);
  const [food, setFood] = useState(0);
  const [other, setOther] = useState(0);
  const [paid, setPaid] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onDone();
    }
  }, [state.ok, onDone, router]);

  // keep rent in sync when tenant changes
  useEffect(() => {
    setRent(selected?.rent_amount ?? 0);
  }, [selected?.rent_amount]);

  const total = useMemo(
    () => rent + power + food + other,
    [rent, power, food, other],
  );
  const balance = Math.max(total - paid, 0);
  const status = paid >= total && total > 0 ? "paid" : paid > 0 ? "partial" : "due";
  const statusColor =
    status === "paid"
      ? "text-teal-600"
      : status === "partial"
        ? "text-gold-600"
        : "text-rose-600";

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Tenant" htmlFor="tenant_id">
          <Select
            id="tenant_id"
            name="tenant_id"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.room_label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="For month" htmlFor="month_for">
          <Input id="month_for" name="month_for" type="month" defaultValue={month} />
        </FieldRow>
      </div>

      <div className="rounded-xl border border-line bg-paper-2/50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Rent calculator
        </p>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Base rent" htmlFor="base_rent">
            <Input id="base_rent" name="base_rent" type="number" min={0} value={rent} onChange={(e) => setRent(+e.target.value)} />
          </FieldRow>
          <FieldRow label="Electricity" htmlFor="electricity_charge">
            <Input id="electricity_charge" name="electricity_charge" type="number" min={0} value={power} onChange={(e) => setPower(+e.target.value)} />
          </FieldRow>
          <FieldRow label="Food" htmlFor="food_charge">
            <Input id="food_charge" name="food_charge" type="number" min={0} value={food} onChange={(e) => setFood(+e.target.value)} />
          </FieldRow>
          <FieldRow label="Other" htmlFor="other_charges">
            <Input id="other_charges" name="other_charges" type="number" min={0} value={other} onChange={(e) => setOther(+e.target.value)} />
          </FieldRow>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg bg-ink px-4 py-3 text-paper">
          <span className="text-sm text-paper/70">Total billed</span>
          <span className="flex items-center font-display text-xl font-semibold tnum">
            <IndianRupee className="size-4" />
            {total.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Amount paid" htmlFor="amount_paid">
          <Input id="amount_paid" name="amount_paid" type="number" min={0} value={paid} onChange={(e) => setPaid(+e.target.value)} />
        </FieldRow>
        <FieldRow label="Mode" htmlFor="payment_mode">
          <Select id="payment_mode" name="payment_mode" defaultValue="upi">
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank transfer</option>
          </Select>
        </FieldRow>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-sm">
        <span className="text-ink-soft">
          Balance <span className="font-semibold text-ink tnum">{inr(balance)}</span>
        </span>
        <span className={`font-semibold capitalize ${statusColor}`}>{status}</span>
      </div>

      <FieldRow label="Notes" htmlFor="notes">
        <Input id="notes" name="notes" placeholder="Optional note" />
      </FieldRow>

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
            "Save payment"
          )}
        </Button>
      </div>
    </form>
  );
}
