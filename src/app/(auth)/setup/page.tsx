import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getSession } from "@/lib/auth";
import { needsBootstrap } from "@/lib/actions/bootstrap";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "First-time setup" };
// This page queries the DB unconditionally (needsBootstrap) regardless of
// whether a session cookie is present, so Next.js's implicit dynamic-API
// detection isn't enough to keep it out of static generation at build time —
// same reasoning as the (admin)/(super-admin)/(tenant) layouts.
export const dynamic = "force-dynamic";

/** One-time setup wizard for the first super_admin on a fresh database.
 *  Self-closes forever once any user exists — see needsBootstrap(). */
export default async function SetupPage() {
  const session = await getSession();
  if (session) redirect("/login");
  if (!(await needsBootstrap())) redirect("/login");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <Logo />
        <div className="mt-6 flex items-center gap-2 text-sm font-medium text-teal-700">
          <ShieldCheck className="size-4" /> First-time setup
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
          Create the admin account
        </h1>
        <p className="mt-1.5 text-ink-muted">
          This database has no accounts yet. Set up the first super admin login —
          you&apos;ll use it to add PGs and owners afterward.
        </p>
        <div className="mt-8">
          <SetupForm />
        </div>
        <p className="mt-8 text-center text-xs text-ink-muted">
          Already set up?{" "}
          <Link href="/login" className="font-medium text-ink-soft underline underline-offset-2 hover:text-ink">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
