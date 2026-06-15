"use client";

import { useActionState, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldRow, Select, Textarea } from "@/components/ui/field";
import { raiseIssueAction, type ActionState } from "@/lib/actions/tenant";

export function RaiseIssueForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    raiseIssueAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      {state.ok && (
        <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-3 text-sm font-medium text-teal-700">
          <CheckCircle2 className="size-4 shrink-0" /> Raised! Your PG owner has been notified.
        </div>
      )}

      <FieldRow label="Category" htmlFor="category">
        <Select id="category" name="category" defaultValue="electricity">
          <option value="electricity">Electricity</option>
          <option value="plumbing">Plumbing</option>
          <option value="wifi">WiFi</option>
          <option value="cleaning">Cleaning</option>
          <option value="noise">Noise</option>
          <option value="other">Other</option>
        </Select>
      </FieldRow>

      <FieldRow label="What's the problem?" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          placeholder="e.g. The geyser in the bathroom isn't heating since yesterday."
          required
        />
      </FieldRow>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send className="size-4" /> Raise complaint
          </>
        )}
      </Button>
    </form>
  );
}
