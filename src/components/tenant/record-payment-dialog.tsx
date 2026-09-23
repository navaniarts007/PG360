"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ImageUp, IndianRupee, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FieldRow, Input, Select } from "@/components/ui/field";
import { uploadToStorage } from "@/lib/upload-client";
import { tenantRecordPaymentAction } from "@/lib/actions/tenant";

export function TenantRecordPaymentDialog({
  month,
  balance,
}: {
  month: string;
  balance: number;
}) {
  return (
    <Modal
      title="Record your payment"
      description="Tell your PG owner what you paid. UPI payments need a screenshot."
      trigger={(open) => (
        <Button onClick={open} className="w-full">
          <Wallet className="size-4" /> I&apos;ve paid — record it
        </Button>
      )}
    >
      {(close) => <PayForm month={month} balance={balance} onDone={close} />}
    </Modal>
  );
}

function PayForm({
  month,
  balance,
  onDone,
}: {
  month: string;
  balance: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"upi" | "cash" | "bank">("upi");
  const [amount, setAmount] = useState(balance > 0 ? balance : 0);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    setError(null);
    if (amount <= 0) return setError("Enter the amount you paid.");
    if (mode === "upi" && !file) return setError("Please attach your UPI payment screenshot.");

    start(async () => {
      let screenshotUrl: string | undefined;
      try {
        if (file) {
          screenshotUrl = await uploadToStorage(file, "pg360/payments");
        }
        const body = new FormData();
        body.set("month_for", month);
        body.set("amount_paid", String(amount));
        body.set("payment_mode", mode);
        body.set("payment_date", payDate);
        if (screenshotUrl) body.set("screenshot_url", screenshotUrl);
        const result = await tenantRecordPaymentAction({}, body);
        if (result.error) {
          setError(result.error);
          return;
        }
        onDone();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Amount paid (₹)" htmlFor="amount">
          <Input
            id="amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(+e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Method" htmlFor="mode">
          <Select
            id="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as "upi" | "cash" | "bank")}
          >
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank transfer</option>
          </Select>
        </FieldRow>
        <FieldRow label="Payment date" htmlFor="pay_date" className="col-span-2">
          <Input id="pay_date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
        </FieldRow>
      </div>

      {mode === "upi" && (
        <div className="rounded-xl border border-line bg-paper-2/50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            UPI payment screenshot
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface px-3 py-3 text-sm font-semibold text-ink-soft transition-colors hover:text-clay-600"
          >
            <ImageUp className="size-4" />
            {file ? file.name : "Choose screenshot"}
          </button>
          <p className="mt-1.5 text-xs text-ink-muted">
            Your owner verifies this before marking the bill paid.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-paper">
        <span className="text-sm text-paper/70">Recording</span>
        <span className="flex items-center font-display text-xl font-semibold tnum">
          <IndianRupee className="size-4" />
          {amount.toLocaleString("en-IN")}
        </span>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" className="flex-1" onClick={submit} disabled={pending}>
          {pending ? <><Loader2 className="size-4 animate-spin" /> Submitting…</> : "Submit payment"}
        </Button>
      </div>
    </div>
  );
}
