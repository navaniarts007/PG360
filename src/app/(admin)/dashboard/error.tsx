"use client";

import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[55vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <AlertTriangle className="size-7" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold text-ink">
          This page didn&apos;t load
        </h2>
        <p className="mt-2 break-words text-sm text-ink-muted">
          {error.message || "Something went wrong. Please try again."}
        </p>
        <button
          onClick={reset}
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-clay-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-clay-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
