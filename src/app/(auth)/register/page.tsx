import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { RegisterForm } from "./register-form";
import { getSession, homeForRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect(homeForRole(session.role));

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-paper lg:flex lg:flex-col lg:justify-between">
        <div className="grain absolute inset-0" />
        <div
          className="pointer-events-none absolute -right-24 top-1/4 size-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(194,83,29,0.35), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -left-20 bottom-0 size-80 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(217,164,65,0.18), transparent 70%)" }}
        />
        <div className="relative">
          <Logo invert />
        </div>
        <div className="relative">
          <h2 className="max-w-md font-display text-4xl font-semibold leading-tight tracking-tight">
            Create your owner account in minutes — no card, no sales call.
          </h2>
          <p className="mt-4 max-w-sm text-paper/60">
            Add rooms, beds and rent. Onboard tenants with one click — logins included.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-paper/50">
            <ShieldCheck className="size-4 text-teal-300" />
            3-day free trial, no card required.
          </div>
        </div>
        <div className="relative text-sm text-paper/40">
          © {new Date().getFullYear()} PG360 · Made in India
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col items-center justify-center px-5 py-10 sm:px-8">
        <Link
          href="/"
          className="absolute left-5 top-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink sm:left-8 sm:top-8"
        >
          <ArrowLeft className="size-4" /> Back home
        </Link>

        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Logo />
          </div>
          <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight text-ink lg:mt-0">
            Create your account
          </h1>
          <p className="mt-1.5 text-ink-muted">
            Start free — add your PG, no card needed.
          </p>

          <div className="mt-8">
            <RegisterForm />
          </div>
        </div>
      </main>
    </div>
  );
}
