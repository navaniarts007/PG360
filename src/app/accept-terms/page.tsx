import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Lock, Database, FileCheck2 } from "lucide-react";
import { requireRole } from "@/lib/guards";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/brand/logo";
import { AcceptTermsForm } from "@/components/app/accept-terms-form";

export const metadata: Metadata = { title: "Welcome — accept terms" };

export default async function AcceptTermsPage() {
  const user = await requireRole(["admin", "staff"]);
  const session = await getSession();
  // already accepted (or impersonating) → straight to the dashboard
  if (session?.termsAcceptedAt) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-paper-2 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-2xl border border-line bg-surface p-7 shadow-soft sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay-500">
            Welcome, {user.full_name.split(" ")[0]}
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-semibold text-ink sm:text-3xl">
            A quick note before you start
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Please review and accept our terms. Here&apos;s what matters most about how we
            handle your data.
          </p>

          <div className="mt-6 space-y-4">
            <Commitment
              icon={MapPin}
              title="Your data stays in India"
              body="All your data — tenants, payments, documents and photos — is stored and processed on servers located in India (Mumbai region). We do not move your data outside the country."
            />
            <Commitment
              icon={Lock}
              title="Kept safe & private"
              body="Data is encrypted in transit and at rest, isolated per property, and access-controlled. We never sell your data or share it with third parties for marketing."
            />
            <Commitment
              icon={Database}
              title="You own your data"
              body="The records you create belong to you. You can export or request deletion of your data at any time. We keep it only as long as your account is active or as required by law."
            />
            <Commitment
              icon={FileCheck2}
              title="Fair & transparent use"
              body="Use PG360 lawfully for managing your PG/hostel. Subscription fees are billed as agreed; the service is provided on an as-is basis with reasonable uptime efforts."
            />
          </div>

          <div className="mt-7">
            <AcceptTermsForm />
          </div>

          <p className="mt-4 text-center text-xs text-ink-muted">
            Read the full{" "}
            <a href="/terms" target="_blank" className="font-semibold text-clay-600 hover:underline">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" className="font-semibold text-clay-600 hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function Commitment({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{body}</p>
      </div>
    </div>
  );
}
