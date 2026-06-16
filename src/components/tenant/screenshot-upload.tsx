"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ImageUp, Loader2 } from "lucide-react";
import {
  getUploadSignatureAction,
  savePaymentScreenshotAction,
} from "@/lib/actions/upload";

export function ScreenshotUpload({
  paymentId,
  existingUrl,
  hiddenInputId,
}: {
  paymentId?: string | null;
  existingUrl?: string | null;
  hiddenInputId?: string;
}) {
  const [url, setUrl] = useState<string | null | undefined>(existingUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const sig = await getUploadSignatureAction();
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

      // If a paymentId was provided, persist the screenshot against that payment.
      if (paymentId) {
        const saved = await savePaymentScreenshotAction(paymentId, json.secure_url);
        if (saved.error) throw new Error(saved.error);
      } else if (hiddenInputId) {
        // No payment yet: write the uploaded URL into the named hidden input so
        // a surrounding form can submit it to a server action.
        try {
          const el = document.getElementById(hiddenInputId) as HTMLInputElement | null;
          if (el) {
            el.value = json.secure_url;
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        } catch {
          // ignore DOM errors — not critical
        }
      }
      setUrl(json.secure_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-paper-2/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Payment proof</p>
          <p className="text-xs text-ink-muted">
            Upload your UPI / bank screenshot so your owner can confirm.
          </p>
        </div>
        {url && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600">
            <CheckCircle2 className="size-3.5" /> Uploaded
          </span>
        )}
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600">
          <AlertCircle className="size-3.5" /> {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPick(f);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-sm font-semibold text-paper transition-colors hover:bg-ink-soft disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
          {url ? "Replace" : "Upload screenshot"}
        </button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-clay-600 hover:text-clay-700"
          >
            View
          </a>
        )}
      </div>
    </div>
  );
}
