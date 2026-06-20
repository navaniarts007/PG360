"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone } from "lucide-react";
import { inr } from "@/lib/utils";

/** Direct-to-owner UPI: a deep-link "Pay now" button (opens GPay/PhonePe with
 *  the amount + note pre-filled) plus a dynamic QR encoding the same intent. */
export function UpiPay({
  vpa,
  payeeName,
  amount,
  note,
}: {
  vpa: string;
  payeeName: string;
  amount: number;
  note: string;
}) {
  const link = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(
    payeeName,
  )}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 320, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null));
  }, [link]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr}
          alt={`Scan to pay ${inr(amount)}`}
          className="size-36 shrink-0 self-center rounded-xl border border-line bg-white p-1.5"
        />
      )}
      <div className="flex-1 space-y-2">
        <a
          href={link}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-clay-600 px-5 py-3.5 text-base font-semibold text-white shadow-soft transition-colors hover:bg-clay-700 active:scale-[0.99]"
        >
          <Smartphone className="size-5" /> Pay {inr(amount)} via UPI
        </a>
        <p className="text-center text-xs text-ink-muted sm:text-left">
          Opens your UPI app (GPay / PhonePe / Paytm) with the amount filled in.
          Pays <span className="font-mono text-ink-soft">{vpa}</span> directly. On a
          computer? Scan the QR.
        </p>
      </div>
    </div>
  );
}
