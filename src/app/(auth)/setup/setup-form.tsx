"use client";

import { useActionState } from "react";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { bootstrapAction, type BootstrapState } from "@/lib/actions/bootstrap";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

export function SetupForm() {
  const [state, action, pending] = useActionState<BootstrapState, FormData>(bootstrapAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" type="text" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@yourpg.in" required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div>
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Creating…
          </>
        ) : (
          <>
            Create account <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  );
}
