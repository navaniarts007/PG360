"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, DoorOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Textarea } from "@/components/ui/field";
import { saveSettlementAction, type ActionState } from "@/lib/actions/admin";
import { computeSettlement } from "@/lib/money";
import { inr } from "@/lib/utils";
import type { Tenant } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

export function CheckoutSettlementDialog({
  tenant,
  noticePeriodDays,
}: {
  tenant: Tenant;
  noticePeriodDays: number;
}) {
  return (
    <Modal
      title={`Checkout settlement — ${tenant.name}`}
      description="Calculate the final deposit refund, then check the tenant out."
      trigger={(open) => (
        <Button variant="outline" size="sm" onClick={open}>
          <DoorOpen className="size-4" /> Checkout & settle
        </Button>
      )}
    >
      {(close) => (
        <SettlementForm tenant={tenant} noticePeriodDays={noticePeriodDays} onDone={close} />
      )}
    </Modal>
  );
}

function SettlementForm({
  tenant,
  noticePeriodDays,
  onDone,
}: {
  tenant: Tenant;
  noticePeriodDays: number;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveSettlementAction,
    {},
  );
  const [checkout, setCheckout] = useState(today());
  const [lastPaid, setLastPaid] = useState("");
  const [noticeGiven, setNoticeGiven] = useState(tenant.notice_given_date ?? "");
  const [damages, setDamages] = useState("0");
  const [advance, setAdvance] = useState("0");

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  // Live preview — recomputed client-side (the server recomputes on submit).
  const preview = computeSettlement({
    pricePerMonth: tenant.rent_amount,
    checkoutISO: checkout || today(),
    lastPaidUntilISO: lastPaid || null,
    noticeGivenISO: noticeGiven || null,
    noticePeriodDays,
    lockInEndISO: tenant.lock_in_end_date,
    depositAmount: tenant.security_deposit,
    damages: Number(damages) || 0,
    advanceAmount: Number(advance) || 0,
  });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tenant_id" value={tenant.id} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Checkout date" htmlFor="checkout_date">
          <Input
            id="checkout_date"
            name="checkout_date"
            type="date"
            value={checkout}
            onChange={(e) => setCheckout(e.target.value)}
            required
          />
        </FieldRow>
        <FieldRow label="Rent paid until" htmlFor="last_paid_until" hint="optional">
          <Input
            id="last_paid_until"
            name="last_paid_until"
            type="date"
            value={lastPaid}
            onChange={(e) => setLastPaid(e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Notice given on" htmlFor="notice_given_date" hint="optional">
          <Input
            id="notice_given_date"
            name="notice_given_date"
            type="date"
            value={noticeGiven}
            onChange={(e) => setNoticeGiven(e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Damages (₹)" htmlFor="damages">
          <Input
            id="damages"
            name="damages"
            type="number"
            min={0}
            value={damages}
            onChange={(e) => setDamages(e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Advance to refund/adjust (₹)" htmlFor="advance_amount" hint="paid-in-advance credit">
          <Input
            id="advance_amount"
            name="advance_amount"
            type="number"
            min={0}
            value={advance}
            onChange={(e) => setAdvance(e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Notes" htmlFor="notes" className="col-span-2">
          <Textarea id="notes" name="notes" placeholder="Anything to record about this settlement" />
        </FieldRow>
      </div>

      {/* Live breakdown */}
      <div className="rounded-xl border border-line bg-paper-2/40 p-4 text-sm">
        <Line label="Security deposit" value={preview.depositAmount} />
        {preview.advanceAmount > 0 && <Line label="Advance credit" value={preview.advanceAmount} />}
        <Line label={`Unpaid rent (${preview.proRataDaysOwed}d × ₹${preview.dailyRate}/day)`} value={-preview.proRataAmount} muted />
        <Line label={`Short-notice penalty (${preview.noticeShortfallDays}d)`} value={-preview.noticePenalty} muted />
        <Line label="Lock-in forfeiture" value={-preview.lockInForfeiture} muted />
        <Line label="Damages" value={-preview.damages} muted />
        <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
          <span className="font-semibold text-ink">
            {preview.amountDue > 0 ? "Tenant pays" : "Refundable to tenant"}
          </span>
          <span
            className={`font-display text-xl font-semibold tnum ${preview.amountDue > 0 ? "text-rose-600" : "text-teal-700"}`}
          >
            {inr(preview.amountDue > 0 ? preview.amountDue : preview.refundableAmount)}
          </span>
        </div>
        {preview.advanceAmount > 0 && (
          <p className="mt-1.5 text-xs text-ink-muted">
            {preview.amountDue > 0
              ? `₹${preview.advanceAmount.toLocaleString("en-IN")} advance adjusted against dues.`
              : `Includes ₹${preview.advanceAmount.toLocaleString("en-IN")} advance refunded.`}
          </p>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" className="flex-1" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Settling…
            </>
          ) : (
            "Confirm & check out"
          )}
        </Button>
      </div>
    </form>
  );
}

function Line({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={muted ? "text-ink-muted" : "text-ink-soft"}>{label}</span>
      <span className={`tnum ${value < 0 ? "text-rose-600" : "text-ink"}`}>
        {value < 0 ? `− ${inr(Math.abs(value))}` : inr(value)}
      </span>
    </div>
  );
}
