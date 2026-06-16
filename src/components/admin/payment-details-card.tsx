"use client";

import { useActionState, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ImageUp,
  Landmark,
  Loader2,
  QrCode,
  Smartphone,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldRow, Input, Textarea } from "@/components/ui/field";
import {
  getUploadSignatureAction,
  savePaymentDetailsAction,
} from "@/lib/actions/upload";

export function PaymentDetailsCard({
  upiId,
  bankDetails,
  qrUrl,
}: {
  upiId: string | null;
  bankDetails: string | null;
  qrUrl: string | null;
}) {
  const [state, action, pending] = useActionState(savePaymentDetailsAction, {});
  const [qr, setQr] = useState(qrUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadQr = async (file: File) => {
    setUploading(true);
    setUploadErr(null);
    try {
      const sig = await getUploadSignatureAction("pg360/qr");
      if (!sig.ok) throw new Error(sig.error);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.apiKey);
      fd.append("timestamp", String(sig.timestamp));
      fd.append("signature", sig.signature);
      fd.append("folder", sig.folder);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: "POST", body: fd },
      );
      const json = (await res.json()) as { secure_url?: string; error?: { message: string } };
      if (!json.secure_url) throw new Error(json.error?.message ?? "Upload failed.");
      setQr(json.secure_url);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
          <QrCode className="size-5" />
        </span>
        <div>
          <h3 className="text-lg text-ink">Payment details</h3>
          <p className="text-sm text-ink-muted">
            Shown to every tenant on their bill so they know where to pay.
          </p>
        </div>
      </div>

      <form action={action} className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          {state.error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
              <AlertCircle className="size-4 shrink-0" /> {state.error}
            </div>
          )}
          {state.ok && (
            <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-3 text-sm font-medium text-teal-700">
              <CheckCircle2 className="size-4 shrink-0" /> Saved — visible on tenant bills now.
            </div>
          )}
          <FieldRow label="UPI ID" htmlFor="upi_id">
            <div className="relative">
              <Smartphone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <Input id="upi_id" name="upi_id" defaultValue={upiId ?? ""} placeholder="sunrisepg@okhdfcbank" className="pl-9" />
            </div>
          </FieldRow>
          <FieldRow label="Bank details" htmlFor="bank_details">
            <div className="relative">
              <Landmark className="pointer-events-none absolute left-3 top-3 size-4 text-ink-muted" />
              <Textarea
                id="bank_details"
                name="bank_details"
                defaultValue={bankDetails ?? ""}
                placeholder={"A/c name: Sunrise Stay\nA/c no: 0000 0000 0000\nIFSC: HDFC0000000"}
                className="pl-9"
              />
            </div>
          </FieldRow>
          <input type="hidden" name="payment_qr_url" value={qr ?? ""} />
          <Button type="submit" disabled={pending}>
            {pending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Save payment details"}
          </Button>
        </div>

        {/* QR */}
        <div className="lg:w-48">
          <p className="mb-2 text-sm font-medium text-ink-soft">Payment QR</p>
          <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl border border-dashed border-line-strong bg-paper-2/40">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="Payment QR" className="size-full object-contain" />
            ) : (
              <QrCode className="size-10 text-ink-muted" />
            )}
          </div>
          {uploadErr && <p className="mt-1 text-xs text-rose-600">{uploadErr}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadQr(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-clay-600 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
            {qr ? "Replace QR" : "Upload QR"}
          </button>
        </div>
      </form>
    </Card>
  );
}
