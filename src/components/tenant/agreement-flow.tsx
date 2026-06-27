"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/signature-pad";
import { acceptAgreementAction, type ActionState } from "@/lib/actions/agreement";
import type { AgreementSection } from "@/lib/types";

export function AgreementFlow({
  sections,
  brandName,
}: {
  sections: AgreementSection[];
  brandName: string;
}) {
  const [step, setStep] = useState(0);
  const total = sections.length;
  const onSign = step >= total;

  return (
    <div>
      {/* progress */}
      <div className="mb-5 flex items-center gap-1.5">
        {Array.from({ length: total + 1 }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-clay-500" : "bg-line"}`}
          />
        ))}
      </div>

      {!onSign ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-clay-500">
            Section {step + 1} of {total}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
            {sections[step]!.title}
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
            {sections[step]!.body || "—"}
          </p>
          <div className="mt-6 flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="size-4" /> Back
              </Button>
            )}
            <Button className="flex-1" onClick={() => setStep((s) => s + 1)}>
              I agree &amp; continue <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <SignStep brandName={brandName} onBack={() => setStep(total - 1)} />
      )}
    </div>
  );
}

function SignStep({ brandName, onBack }: { brandName: string; onBack: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(acceptAgreementAction, {});
  const [value, setValue] = useState<string | null>(null);

  return (
    <form action={action}>
      <input type="hidden" name="signature_url" value={value ?? ""} />
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-600">
        <CheckCircle2 className="size-3.5" /> All sections agreed
      </p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-ink">Add your signature</h2>
      <p className="mt-1 text-sm text-ink-soft">
        By signing, you accept all the terms of {brandName}.
      </p>

      {state.error && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <div className="mt-4">
        <SignaturePad onChange={setValue} />
      </div>

      <div className="mt-6 flex gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button type="submit" className="flex-1" disabled={pending || !value}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Agree & finish"
          )}
        </Button>
      </div>
    </form>
  );
}
