import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
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
          Reset your password
        </h1>
        <p className="mt-1.5 text-ink-muted">
          Enter your account email and we&apos;ll send you a link to set a new password.
        </p>
        {expired && (
          <p className="mt-4 rounded-xl border border-gold-200 bg-gold-50 px-3.5 py-3 text-sm font-medium text-gold-700">
            That reset link expired or was already used. Request a fresh one below.
          </p>
        )}
        <div className="mt-8">
          <ForgotForm />
        </div>
      </div>
    </main>
  );
}
