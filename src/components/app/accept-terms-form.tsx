"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { acceptTermsAction } from "@/lib/actions/account";

export function AcceptTermsForm() {
  const [checked, setChecked] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 rounded-xl border border-line bg-paper-2/40 p-4 text-sm text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 size-4 rounded border-line text-clay-600 focus:ring-clay-500"
        />
        <span>
          I have read and agree to the Terms of Service, the Privacy Policy, and the
          data-handling commitments above.
        </span>
      </label>

      <button
        onClick={() => start(() => void acceptTermsAction())}
        disabled={!checked || pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-clay-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-clay-700 disabled:opacity-50"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <ShieldCheck className="size-4" /> Accept &amp; continue
          </>
        )}
      </button>
    </div>
  );
}
