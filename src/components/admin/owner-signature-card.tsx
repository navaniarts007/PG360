"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, PenLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SignaturePad } from "@/components/signature-pad";
import { saveOwnerSignatureAction, type ActionState } from "@/lib/actions/agreement";

/** The owner's signature, shown on every resident's signed agreement. */
export function OwnerSignatureCard({ savedUrl }: { savedUrl: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveOwnerSignatureAction, {});
  const [value, setValue] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<string | null>(null);
  const router = useRouter();

  // auto-save the moment a signature is captured
  useEffect(() => {
    if (value && submitted.current !== value) {
      submitted.current = value;
      formRef.current?.requestSubmit();
    }
  }, [value]);
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
          <PenLine className="size-5" />
        </span>
        <div>
          <h3 className="text-lg text-ink">Owner signature</h3>
          <p className="text-sm text-ink-muted">
            Signed once and shown on every resident&apos;s agreement.
          </p>
        </div>
      </div>

      <form ref={formRef} action={action} className="mt-5 space-y-3">
        <input type="hidden" name="signature_url" value={value ?? ""} />
        {state.error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
            <AlertCircle className="size-3.5 shrink-0" /> {state.error}
          </div>
        )}

        {savedUrl && !state.ok && (
          <div className="rounded-xl border border-line bg-paper-2/40 p-3">
            <p className="mb-1 text-xs font-semibold text-teal-600">✓ Current signature</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={savedUrl} alt="Owner signature" className="max-h-16 object-contain" />
            <p className="mt-1 text-xs text-ink-muted">Draw or upload below to replace it.</p>
          </div>
        )}
        {(state.ok || (value && pending)) && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-teal-600">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {pending ? "Saving signature…" : "✓ Owner signature saved"}
          </p>
        )}

        <SignaturePad onChange={setValue} />
      </form>
    </Card>
  );
}
