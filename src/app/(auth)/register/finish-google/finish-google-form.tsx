"use client";

import { useActionState } from "react";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { completeGoogleRegistrationAction, type RegisterState } from "@/lib/actions/register";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

export function FinishGoogleForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    completeGoogleRegistrationAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      {name && (
        <div>
          <Label htmlFor="owner_name_display">Name</Label>
          <Input id="owner_name_display" value={name} disabled />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="pg_name">PG name</Label>
          <Input id="pg_name" name="pg_name" placeholder="Sunrise PG" required />
        </div>
        <div>
          <Label htmlFor="mobile">Mobile</Label>
          <Input id="mobile" name="mobile" type="tel" autoComplete="tel" placeholder="98765 43210" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" placeholder="Koramangala, Bengaluru" required />
        </div>
        <div>
          <Label htmlFor="pg_type">PG type</Label>
          <Select id="pg_type" name="pg_type" defaultValue="coliving" required>
            <option value="boys">Boys</option>
            <option value="girls">Girls</option>
            <option value="coliving">Co-living</option>
          </Select>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Setting up…
          </>
        ) : (
          <>
            Finish setup <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </form>
  );
}
