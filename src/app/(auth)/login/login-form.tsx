"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { loginAction, type LoginState } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

export function LoginForm({
  initialEmail = "",
  initialPassword = "",
}: {
  initialEmail?: string;
  initialPassword?: string;
}) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={initialEmail}
          placeholder="you@yourpg.in"
          required
        />
      </div>

      <div>
        <Label
          htmlFor="password"
          hint={
            <Link href="/forgot-password" className="font-semibold text-clay-600 hover:text-clay-700">
              Forgot?
            </Link>
          }
        >
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            defaultValue={initialPassword}
            placeholder="••••••••"
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

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Signing in…
          </>
        ) : (
          <>
            Sign in <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  );
}
