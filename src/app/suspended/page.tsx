import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LogoutButton } from "@/components/app/logout-button";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Account suspended" };

export default async function SuspendedPage() {
  const session = await getSession();
  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-soft">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
            <ShieldAlert className="size-7" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">
            This PG account is suspended
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {session
              ? "Access is paused. Your data is safe — please contact PG360 support to reactivate your subscription."
              : "Please sign in."}
          </p>
          <a
            href="https://wa.me/919000000001"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-clay-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-clay-700"
          >
            Contact support
          </a>
          {session && (
            <div className="mt-4 border-t border-line pt-4">
              <LogoutButton className="justify-center" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
