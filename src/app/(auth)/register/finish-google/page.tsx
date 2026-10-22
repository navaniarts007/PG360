import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { FinishGoogleForm } from "./finish-google-form";
import { getGoogleRegistrationContext } from "@/lib/actions/register";

export const metadata: Metadata = { title: "Finish setting up your PG" };

export default async function FinishGooglePage() {
  const ctx = await getGoogleRegistrationContext();
  if (!ctx.ok) redirect(ctx.redirectTo);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-8">
      <div className="w-full max-w-sm">
        <Logo />
        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight text-ink">
          Almost there
        </h1>
        <p className="mt-1.5 text-ink-muted">
          Signed in as <span className="font-medium text-ink">{ctx.email}</span> — just need a
          few details about your PG.
        </p>

        <div className="mt-8">
          <FinishGoogleForm name={ctx.name} />
        </div>
      </div>
    </main>
  );
}
