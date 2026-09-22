"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, Check, ChevronDown, ChevronUp, ImageUp, IndianRupee, Loader2, Printer, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { recordPaymentAction, type RecordPaymentState } from "@/lib/actions/admin";
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
          variant={variant}
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
  variant?: "primary" | "collect";
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<RecordPaymentState, FormData>(
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

  // State for revealing/collapsing the collection item picker
  const [showCollectPicker, setShowCollectPicker] = useState(false);

  // State for which items are selected for collection right now
  const [collectRent, setCollectRent] = useState(true);
  const [collectPower, setCollectPower] = useState(false);
  const [collectFood, setCollectFood] = useState(false);
  const [collectOther, setCollectOther] = useState(false);
  const [collectDeposit, setCollectDeposit] = useState((init?.deposit ?? 0) > 0);
  const [collectJoining, setCollectJoining] = useState((prefill?.joining ?? 0) > 0);

  // Amount paid state
  const initialPaid = prefill?.amountPaid ?? (init?.baseRent ?? monthly) + (init?.deposit ?? 0);
  const [paid, setPaid] = useState(initialPaid);

  // Auto-calculate paid amount when collection toggles change
  const toggleCollect = (itemKey: string) => {
    let nextRent = collectRent;
    let nextPower = collectPower;
    let nextFood = collectFood;
    let nextOther = collectOther;
    let nextDeposit = collectDeposit;
    let nextJoining = collectJoining;

    if (itemKey === "rent") { nextRent = !collectRent; setCollectRent(nextRent); }
    if (itemKey === "power") { nextPower = !collectPower; setCollectPower(nextPower); }
    if (itemKey === "food") { nextFood = !collectFood; setCollectFood(nextFood); }
    if (itemKey === "other") { nextOther = !collectOther; setCollectOther(nextOther); }
    if (itemKey === "deposit") { nextDeposit = !collectDeposit; setCollectDeposit(nextDeposit); }
    if (itemKey === "joining") { nextJoining = !collectJoining; setCollectJoining(nextJoining); }

    const newPaidSum =
      (nextRent ? rent : 0) +
      (nextPower ? power : 0) +
      (nextFood ? food : 0) +
      (nextOther ? other : 0) +
      (nextDeposit ? deposit : 0) +
      (nextJoining ? joining : 0);

    setPaid(newPaidSum);
  };

  const selectedCollectTotal =
    (collectRent ? rent : 0) +
    (collectPower ? power : 0) +
    (collectFood ? food : 0) +
    (collectOther ? other : 0) +
    (collectDeposit ? deposit : 0) +
    (collectJoining ? joining : 0);

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

  // On success, stay open and show the print prompt instead of closing
  // immediately — refresh the background data now so it's current once the
  // dialog does close, but let the admin choose when that happens.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

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
    setCollectRent(true);
    setCollectPower(false);
    setCollectFood(false);
    setCollectOther(false);
    setCollectDeposit(c.deposit > 0);
    setCollectJoining(false);
    setPaid(c.baseRent + (c.deposit > 0 ? c.deposit : 0));
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

  if (state.ok) {
    return (
      <div className="space-y-5 py-2 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <Check className="size-7" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold text-ink">Payment saved</p>
          <p className="mt-1 text-sm text-ink-muted">
            {paid > 0
              ? `${inr(paid)} recorded for ${selected?.name ?? "the tenant"}.`
              : "Bill saved."}
          </p>
        </div>
        <div className="flex gap-2">
          {state.paymentId ? (
            <a
              href={`/receipt/${state.paymentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-clay-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-clay-700"
            >
              <Printer className="size-4" /> Print receipt
            </a>
          ) : (
            <span className="flex-1" />
          )}
          <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    );
  }

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

      {/* ── Choose payment items to collect (Collapsible Reveal after Payment Date) ── */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface transition-all">
        {/* Clickable Header Button to Reveal/Hide */}
        <button
          type="button"
          onClick={() => setShowCollectPicker(!showCollectPicker)}
          className="flex w-full items-center justify-between border-b border-line bg-paper-2/70 px-4 py-3 text-left transition-colors hover:bg-paper-2"
        >
          <div className="flex items-center gap-2">
            {showCollectPicker ? (
              <ChevronUp className="size-4 text-clay-600" />
            ) : (
              <ChevronDown className="size-4 text-clay-600" />
            )}
            <span className="text-xs font-semibold uppercase tracking-wide text-ink">
              Choose payment items to collect
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-100/80 tnum">
              Selected: {inr(selectedCollectTotal)}
            </span>
            <span className="text-xs text-ink-muted">
              {showCollectPicker ? "Hide items" : "Click to select"}
            </span>
          </div>
        </button>

        {/* Revealed checklist content */}
        {showCollectPicker && (
          <>
            <div className="bg-clay-50/50 px-4 py-2 border-b border-line text-[0.75rem] font-medium text-clay-700">
              Check items below to include them in this payment & auto-fill Amount Paid:
            </div>
            <ul className="divide-y divide-line">
              {[
                { key: "rent", label: "Base rent", value: rent, on: collectRent },
                { key: "power", label: "Electricity", value: power, on: collectPower },
                { key: "food", label: "Food", value: food, on: collectFood },
                { key: "other", label: "Other", value: other, on: collectOther },
                { key: "deposit", label: "Security deposit", value: deposit, on: collectDeposit },
                { key: "joining", label: "Joining / admission fee", value: joining, on: collectJoining },
              ].map((item) => (
                <li
                  key={item.key}
                  onClick={() => toggleCollect(item.key)}
                  className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors ${
                    item.on ? "bg-teal-50/60" : "bg-surface hover:bg-paper-2/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        item.on
                          ? "border-teal-600 bg-teal-600 text-white"
                          : "border-line bg-white text-transparent"
                      }`}
                    >
                      <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <polyline points="1.5,6 4.5,9 10.5,3" />
                      </svg>
                    </div>
                    <span className={`text-sm font-medium ${item.on ? "font-semibold text-ink" : "text-ink-soft"}`}>
                      {item.label}
                    </span>
                  </div>
                  <span className={`tnum text-sm font-semibold ${item.on ? "text-teal-700" : "text-ink-muted"}`}>
                    {item.value > 0 ? inr(item.value) : "—"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between border-t border-line bg-paper-2/80 px-4 py-3 text-sm gap-2">
              <div>
                <span className="text-ink-soft">Selected Collection: </span>
                <span className="font-bold text-teal-700 tnum">{inr(selectedCollectTotal)}</span>
              </div>
              <div>
                <span className="text-ink-soft">Balance Remaining: </span>
                <span className={`font-bold tnum ${balance > 0 ? "text-rose-600" : "text-teal-600"}`}>
                  {balance > 0 ? inr(balance) : "✓ Nil"}
                </span>
              </div>
            </div>
          </>
        )}
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
