"use client";

import { Printer } from "lucide-react";

declare global {
  interface Window {
    /** Electron desktop bridge (desktop/preload.js). */
    pg360native?: { platform: string; print: () => void };
    /** Android WebView print bridge (MainActivity.java). */
    PG360Print?: { print: () => void };
  }
}

/** Print / Save as PDF. Plain window.print() works on the web but is unreliable
 *  inside the native wrappers, so we prefer the native bridges when present:
 *  Electron → webContents.print(); Android → the system print framework. */
export function PrintButton() {
  const handlePrint = () => {
    if (typeof window === "undefined") return;
    if (window.pg360native?.print) {
      window.pg360native.print();
      return;
    }
    if (window.PG360Print?.print) {
      window.PG360Print.print();
      return;
    }
    window.print();
  };

  return (
    <button
      onClick={handlePrint}
      className="no-print inline-flex items-center gap-2 rounded-xl bg-clay-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-clay-700"
    >
      <Printer className="size-4" /> Print / Save as PDF
    </button>
  );
}
