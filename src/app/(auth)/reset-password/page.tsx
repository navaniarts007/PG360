import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ResetForm } from "./reset-form";
import { validateResetToken } from "@/lib/auth-actions";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const email = token ? await validateResetToken(token) : null;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <Link
        href="/login"
        className="absolute left-5 top-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink sm:left-8 sm:top-8"
      >
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
      <div className="w-full max-w-sm">
        <Logo />
        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight text-ink">
          Set a new password
        </h1>
        {email && token ? (
          <>
            <p className="mt-1.5 text-ink-muted">
              For <span className="font-medium text-ink">{email}</span> — choose a new
              password (8+ characters).
            </p>
            <div className="mt-8">
              <ResetForm token={token} />
            </div>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-ink-muted">
              This reset link is invalid or has expired.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-clay-600 hover:text-clay-700"
            >
              Request a new link
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
