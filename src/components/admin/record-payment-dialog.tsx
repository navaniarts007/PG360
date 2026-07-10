"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, ImageUp, IndianRupee, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { recordPaymentAction, type ActionState } from "@/lib/actions/admin";
import { getUploadSignatureAction } from "@/lib/actions/upload";
import { inr } from "@/lib/utils";

/** Pre-fill the dialog opens with for a tenant (mirrors db.ts BillSuggestion). */
export interface BillSuggestion {
  baseRent: number;
  days: number;
  deposit: number;
  month: string;
  proRata: boolean;
}

export interface PayTenant {
  id: string;
  name: string;
  rent_amount: number;
  room_label: string;
  checkin_date: string;
  rent_due_day: number;
  security_deposit: number;
  stay_type: "monthly" | "daily";
  suggested: BillSuggestion;
}

/** Optional starting values for the bill — e.g. a tenant's first-month
 *  breakdown (pro-rata rent + deposit + joining) opened from the Collect chip. */
export interface PaymentPrefill {
  baseRent?: number;
  days?: number;
  deposit?: number;
  joining?: number;
  amountPaid?: number;
}


export function RecordPaymentDialog({
  tenants,
  month,
  preselectId,
  variant = "primary",
  prefill,
}: {
  tenants: PayTenant[];
  month: string;
  preselectId?: string;
  /** "primary" = full button, "collect" = compact chip (used in tables/lists). */
  variant?: "primary" | "collect";
  prefill?: PaymentPrefill;
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
          prefill={prefill}
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
  prefill,
  onDone,
}: {
  tenants: PayTenant[];
  month: string;
  preselectId?: string;
  prefill?: PaymentPrefill;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    recordPaymentAction,
    {},
  );
  const first = preselectId ?? tenants[0]?.id ?? "";
  const [tenantId, setTenantId] = useState(first);
  const selected = tenants.find((t) => t.id === tenantId);

  const monthly = selected?.rent_amount ?? 0;
  // initial fill: an explicit prefill (Collect) wins; otherwise the server-
  // computed suggestion (uncollected first month, else full month) so the plain
  // "Record payment" button is pre-filled the same way.
  const init = prefill ?? selected?.suggested;
  const [rent, setRent] = useState(init?.baseRent ?? monthly);
  const [days, setDays] = useState(init?.days ?? 30);
  // billing period: a whole calendar month, or a custom day range
  const [periodMode, setPeriodMode] = useState<"month" | "days">("month");
  const [monthInput, setMonthInput] = useState(
    prefill ? month : selected?.suggested.month ?? month,
  );
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [power, setPower] = useState(0);
  const [food, setFood] = useState(0);
  const [other, setOther] = useState(0);
  const [deposit, setDeposit] = useState(init?.deposit ?? 0);
  const [joining, setJoining] = useState(prefill?.joining ?? 0);
  const [paid, setPaid] = useState(prefill?.amountPaid ?? 0);
  // optional payment screenshot / proof (uploaded to Cloudinary)
  const [shot, setShot] = useState<string | null>(null);
  const [shotBusy, setShotBusy] = useState(false);
  const [shotErr, setShotErr] = useState<string | null>(null);
  const shotFileRef = useRef<HTMLInputElement>(null);
  const shotCamRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const uploadShot = async (file: File) => {
    setShotBusy(true);
    setShotErr(null);
    try {
      const sig = await getUploadSignatureAction("pg360/payments");
      if (!sig.ok) throw new Error(sig.error);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.apiKey);
      fd.append("timestamp", String(sig.timestamp));
      fd.append("signature", sig.signature);
      fd.append("folder", sig.folder);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as { secure_url?: string };
      if (!json.secure_url) throw new Error("Upload failed");
      setShot(json.secure_url);
    } catch (e) {
      setShotErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setShotBusy(false);
    }
  };

  // per-day rate on a fixed 30-day basis (₹7,000/month → ₹233/day → 13 days = ₹3,033)
  const dailyRate = monthly > 0 ? monthly / 30 : 0;

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onDone();
    }
  }, [state.ok, onDone, router]);

  // when the tenant changes, auto-calculate that tenant's first month (rent +
  // deposit + the right month) — but keep the initial fill on first open.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!selected) return;
    const c = selected.suggested;
    setRent(c.baseRent);
    setDays(c.days);
    setDeposit(c.deposit);
    setJoining(0);
    setMonthInput(c.month);
    setPeriodMode("month");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // pro-rata: enter the number of days stayed → base rent = ₹/day × days
  const applyDays = (d: number) => {
    setDays(d);
    setRent(Math.round(dailyRate * d));
  };

  // in date-range mode, derive the number of days (inclusive) from the dates
  const rangeDays =
    fromDate && toDate && toDate >= fromDate
      ? Math.round(
          (new Date(toDate + "T00:00:00").getTime() -
            new Date(fromDate + "T00:00:00").getTime()) /
            86_400_000,
        ) + 1
      : 0;

  useEffect(() => {
    if (periodMode === "days" && rangeDays > 0) {
      setDays(rangeDays);
      setRent(Math.round(dailyRate * rangeDays));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodMode, rangeDays, dailyRate]);

  // the month the bill is filed under (YYYY-MM) — derived from the from-date
  const monthForValue = periodMode === "days" && fromDate ? fromDate.slice(0, 7) : monthInput;
  const periodLabel =
    periodMode === "days" && fromDate && toDate
      ? `${fromDate} → ${toDate} · ${rangeDays} day${rangeDays === 1 ? "" : "s"}`
      : null;

  const total = useMemo(
    () => rent + power + food + other + deposit + joining,
    [rent, power, food, other, deposit, joining],
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

      {/* the period the bill is filed under (YYYY-MM) */}
      <input type="hidden" name="month_for" value={monthForValue} />

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
        <FieldRow label="Bill period" htmlFor="period_mode">
          <Select
            id="period_mode"
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value as "month" | "days")}
          >
            <option value="month">Whole month</option>
            <option value="days">Day range</option>
          </Select>
        </FieldRow>

        {periodMode === "month" ? (
          <FieldRow label="For month" htmlFor="month_pick" className="col-span-2">
            <Input
              id="month_pick"
              type="month"
              value={monthInput}
              onChange={(e) => setMonthInput(e.target.value)}
            />
          </FieldRow>
        ) : (
          <>
            <FieldRow label="From date" htmlFor="from_date">
              <Input id="from_date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </FieldRow>
            <FieldRow label="To date" htmlFor="to_date">
              <Input id="to_date" type="date" min={fromDate || undefined} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </FieldRow>
            {periodLabel && (
              <p className="col-span-2 -mt-1 text-xs font-medium text-clay-700">{periodLabel}</p>
            )}
            <p className="col-span-2 text-[0.7rem] text-ink-muted">
              One bill is stored per calendar month — saving replaces any existing entry for{" "}
              {monthForValue ? monthForValue : "that month"}.
            </p>
          </>
        )}
      </div>

      <div className="rounded-xl border border-line bg-paper-2/50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Rent calculator
        </p>

        {/* day-wise / pro-rata helper — for partial months or short stays */}
        <div className="mb-3 rounded-lg border border-dashed border-line bg-surface px-3 py-2.5">
          <div className="flex items-end justify-between gap-3">
            <FieldRow label="Days billed (pro-rata)" htmlFor="prorata_days">
              <Input
                id="prorata_days"
                type="number"
                min={1}
                max={366}
                value={days}
                disabled={periodMode === "days"}
                onChange={(e) => applyDays(Math.max(1, +e.target.value || 0))}
              />
            </FieldRow>
            <div className="pb-2.5 text-right text-xs text-ink-muted">
              <p>
                <span className="font-semibold text-ink tnum">{inr(Math.round(dailyRate))}</span>/day
              </p>
              <p className="tnum">
                {days} × {inr(Math.round(dailyRate))} = <span className="font-semibold text-ink">{inr(rent)}</span>
              </p>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">
            {periodMode === "days"
              ? "Days come from the date range above — base rent updates automatically."
              : `30 days = one full month (${inr(monthly)}). Enter the actual days for a mid-month join or short stay — base rent updates automatically.`}
          </p>
        </div>

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
          <FieldRow label="Security deposit" htmlFor="security_deposit">
            <Input id="security_deposit" name="security_deposit" type="number" min={0} value={deposit} onChange={(e) => setDeposit(+e.target.value)} />
          </FieldRow>
          <FieldRow label="Joining / admission fee" htmlFor="joining_fee">
            <Input id="joining_fee" name="joining_fee" type="number" min={0} value={joining} onChange={(e) => setJoining(+e.target.value)} />
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
        <FieldRow label="Payment date" htmlFor="payment_date" className="col-span-2">
          <Input id="payment_date" name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
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

      {/* optional payment screenshot / proof */}
      <input type="hidden" name="payment_screenshot_url" value={shot ?? ""} />
      <div className="flex items-center gap-3 rounded-xl border border-line bg-paper-2/40 p-3">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt="Proof" className="size-14 rounded-lg border border-line object-cover" />
        ) : (
          <div className="grid size-14 place-items-center rounded-lg border border-dashed border-line-strong text-ink-muted">
            <ImageUp className="size-5" />
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">Payment screenshot <span className="font-normal text-ink-muted">— optional</span></p>
          <input ref={shotFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadShot(f); }} />
          <input ref={shotCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadShot(f); }} />
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button type="button" onClick={() => shotCamRef.current?.click()} disabled={shotBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-clay-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-clay-700 disabled:opacity-60">
              {shotBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />} Photo
            </button>
            <button type="button" onClick={() => shotFileRef.current?.click()} disabled={shotBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:text-clay-600 disabled:opacity-60">
              <ImageUp className="size-3.5" /> {shot ? "Replace" : "Upload"}
            </button>
          </div>
          {shotErr && <p className="mt-1 text-xs text-rose-600">{shotErr}</p>}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={pending || shotBusy}>
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
