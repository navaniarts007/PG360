"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { registerOwnerAction, type RegisterState } from "@/lib/actions/register";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerOwnerAction,
    {},
  );
  const [show, setShow] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const signUpWithGoogle = async () => {
    setGooglePending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/register/finish-google` },
    });
    if (error) setGooglePending(false); // on success the browser navigates away
  };

  return (
    <div className="space-y-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-600">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      {isSupabaseConfigured() && (
        <>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={googlePending}
            onClick={signUpWithGoogle}
          >
            {googlePending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.1A11.99 11.99 0 0 0 12 24Z" />
                <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.38l4.01-3.1Z" />
                <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.62l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
              </svg>
            )}
            Continue with Google
          </Button>
          <div className="flex items-center gap-3">
            <span className="hairline h-px flex-1" />
            <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">or</span>
            <span className="hairline h-px flex-1" />
          </div>
        </>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="owner_name">Your name</Label>
          <Input id="owner_name" name="owner_name" autoComplete="name" placeholder="Ravi Kumar" required />
        </div>

        <div>
          <Label htmlFor="owner_email">Email</Label>
          <Input
            id="owner_email"
            name="owner_email"
            type="email"
            autoComplete="email"
            placeholder="you@yourpg.in"
            required
          />
        </div>

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

        <div>
          <Label htmlFor="owner_password">Password</Label>
          <div className="relative">
            <Input
              id="owner_password"
              name="owner_password"
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
          <Label htmlFor="confirm_password">Confirm password</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            required
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Creating account…
            </>
          ) : (
            <>
              Start free <ArrowRight className="size-4" />
            </>
          )}
        </Button>

        <p className="text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-clay-600 hover:text-clay-700">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
