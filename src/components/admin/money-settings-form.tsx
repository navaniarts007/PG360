"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldRow, Input, Textarea } from "@/components/ui/field";
import { saveMoneySettingsAction } from "@/lib/actions/property";
import type { PgAccount, PgPolicy } from "@/lib/types";

export function MoneySettingsForm({
  pg,
  policy,
}: {
  pg: PgAccount;
  policy: PgPolicy;
}) {
  const [state, action, pending] = useActionState(saveMoneySettingsAction, {});

  return (
    <form action={action} className="space-y-6">
      {/* Food */}
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h3 className="text-lg text-ink">Food</h3>
        <p className="mt-0.5 text-sm text-ink-muted">
          Bangalore PGs usually include food in rent. Tenants can opt out for a deduction.
        </p>
        <label className="mt-4 flex cursor-pointer items-center justify-between gap-4">
          <span className="text-sm font-medium text-ink-soft">
            Food included in rent by default
          </span>
          <input
            type="checkbox"
            name="food_included_default"
            defaultChecked={pg.food_included_default}
            className="peer sr-only"
          />
          <div className="relative h-6 w-11 shrink-0 rounded-full bg-line-strong transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-teal-500 peer-checked:after:translate-x-5" />
        </label>
        <FieldRow
          label="Opt-out deduction (₹ / month)"
          htmlFor="food_opt_out_deduction"
          hint="Deducted from rent if a tenant opts out"
          className="mt-4"
        >
          <Input
            id="food_opt_out_deduction"
            name="food_opt_out_deduction"
            type="number"
            min={0}
            defaultValue={pg.food_opt_out_deduction}
          />
        </FieldRow>
      </section>

      {/* Tenancy policy */}
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h3 className="text-lg text-ink">Tenancy policy</h3>
        <p className="mt-0.5 text-sm text-ink-muted">
          Used by the checkout settlement calculator.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <FieldRow label="Notice period (days)" htmlFor="notice_period_days">
            <Input id="notice_period_days" name="notice_period_days" type="number" min={0} defaultValue={policy.notice_period_days} />
          </FieldRow>
          <FieldRow label="Lock-in (months)" htmlFor="lock_in_months">
            <Input id="lock_in_months" name="lock_in_months" type="number" min={0} defaultValue={policy.lock_in_months} />
          </FieldRow>
          <FieldRow label="Deposit (months of rent)" htmlFor="deposit_months">
            <Input id="deposit_months" name="deposit_months" type="number" min={0} defaultValue={policy.deposit_months} />
          </FieldRow>
        </div>
      </section>

      {/* Electricity */}
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h3 className="text-lg text-ink">Electricity</h3>
        <p className="mt-0.5 text-sm text-ink-muted">
          Free units included; usage above the cap is billed per unit.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FieldRow label="Included units / month" htmlFor="electricity_included_units">
            <Input id="electricity_included_units" name="electricity_included_units" type="number" min={0} defaultValue={policy.electricity_included_units} />
          </FieldRow>
          <FieldRow label="Rate above cap (₹ / unit)" htmlFor="electricity_per_unit_rate">
            <Input id="electricity_per_unit_rate" name="electricity_per_unit_rate" type="number" min={0} defaultValue={policy.electricity_per_unit_rate} />
          </FieldRow>
        </div>
      </section>

      {/* HRA / owner */}
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h3 className="text-lg text-ink">HRA rent receipts</h3>
        <p className="mt-0.5 text-sm text-ink-muted">
          Shown on the rent receipts your IT-employee tenants download for tax.
        </p>
        <div className="mt-4 space-y-3">
          <FieldRow label="Owner PAN" htmlFor="owner_pan" hint="Required on the receipt">
            <Input id="owner_pan" name="owner_pan" placeholder="ABCDE1234F" defaultValue={pg.owner_pan ?? ""} />
          </FieldRow>
          <FieldRow label="Property address" htmlFor="property_address">
            <Textarea
              id="property_address"
              name="property_address"
              placeholder="Full address printed on the receipt"
              defaultValue={pg.property_address ?? ""}
            />
          </FieldRow>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          {state.ok ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-teal-600">
              <CheckCircle2 className="size-4" /> Saved.
            </span>
          ) : state.error ? (
            <span className="text-rose-600">{state.error}</span>
          ) : (
            "These rules drive billing, checkout and receipts."
          )}
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Save money settings"}
        </Button>
      </div>
    </form>
  );
}
