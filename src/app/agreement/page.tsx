import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/guards";
import { getMyAgreementSections, myAgreement } from "@/lib/db";
import { getEdition } from "@/lib/get-client";
import { Logo } from "@/components/brand/logo";
import { AgreementFlow } from "@/components/tenant/agreement-flow";

export const metadata: Metadata = { title: "Resident agreement" };

export default async function AgreementPage() {
  await requireRole(["tenant"]);
  const [sections, signed, edition] = await Promise.all([
    getMyAgreementSections(),
    myAgreement(),
    getEdition(),
  ]);
  // nothing to sign, or already signed → go to the portal
  if (sections.length === 0 || signed) redirect("/portal");

  return (
    <div className="min-h-screen bg-paper-2 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex justify-center">
          <Logo label={edition.brandName} />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-soft sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay-500">
            Welcome to {edition.brandName}
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-semibold text-ink">
            Please review &amp; sign the resident agreement
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            A quick one-time step before you continue.
          </p>
          <div className="mt-6">
            <AgreementFlow sections={sections} brandName={edition.brandName} />
          </div>
        </div>
      </div>
    </div>
  );
}
