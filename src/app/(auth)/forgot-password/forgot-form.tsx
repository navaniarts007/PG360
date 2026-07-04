"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Loader2, MailCheck } from "lucide-react";
import { requestPasswordResetAction, type ResetState } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    requestPasswordResetAction,
    {},
  );

  if (state.sent) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5 text-center">
        <MailCheck className="mx-auto size-8 text-teal-600" />
        <p className="mt-2 font-semibold text-ink">Check your email</p>
        <p className="mt-1 text-sm text-ink-soft">
          If an account exists for that address, we&apos;ve sent a link to reset your
          password. It expires in a little while — use it soon.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-clay-600 hover:text-clay-700"
        >
          Back to sign in <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@yourpg.in" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            Send reset link <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  );
}
