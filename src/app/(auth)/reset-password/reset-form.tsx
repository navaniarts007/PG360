"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { updatePasswordAction, type ResetState } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

export function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    updatePasswordAction,
    {},
  );
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <div>
        <Label htmlFor="password">New password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="pr-11"
            required
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-muted hover:text-ink"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <div>
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" name="confirm" type={show ? "text" : "password"} autoComplete="new-password" placeholder="Re-enter password" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Check className="size-4" /> Update password
          </>
        )}
      </Button>
    </form>
  );
}
