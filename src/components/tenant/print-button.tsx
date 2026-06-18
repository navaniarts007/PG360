"use client";

import { Printer } from "lucide-react";

/** Triggers the browser print dialog (Save as PDF). Hidden when printing. */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-xl bg-clay-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-clay-700"
    >
      <Printer className="size-4" /> Print / Save as PDF
    </button>
  );
}
