"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { changePasswordAction, type ChangePasswordState } from "@/lib/auth-actions";

export function ChangePasswordCard() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    {},
  );
  const [show, setShow] = useState(false);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
          <KeyRound className="size-5" />
        </span>
        <div>
          <h3 className="text-lg text-ink">Password</h3>
          <p className="text-sm text-ink-muted">
            Confirm your current password to set a new one.
          </p>
        </div>
      </div>

      <form action={action} className="mt-5 max-w-sm space-y-4">
        {state.error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
            <AlertCircle className="size-4 shrink-0" /> {state.error}
          </div>
        )}
        {state.done && (
          <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-3 text-sm font-medium text-teal-700">
            <CheckCircle2 className="size-4 shrink-0" /> Password updated.
          </div>
        )}

        <div>
          <Label htmlFor="current">Current password</Label>
          <Input
            id="current"
            name="current"
            type="password"
            autoComplete="current-password"
            placeholder="Your current password"
            required
          />
        </div>

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
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            name="confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Re-enter new password"
            required
          />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Updating…
            </>
          ) : (
            <>
              <KeyRound className="size-4" /> Update password
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}
