import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Crown, ShieldCheck, Building2, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "./login-form";
import { getSession, homeForRole } from "@/lib/auth";
import { getClient } from "@/lib/get-client";

export async function generateMetadata(): Promise<Metadata> {
  const client = await getClient();
  return { title: client.slug === "pg360" ? "Sign in" : `Sign in · ${client.brandName}` };
}

const DEMO = {
  super: { email: "owner@pg360.app", label: "Super admin", icon: Crown },
  admin: { email: "ravi@sunrisepg.in", label: "PG owner", icon: Building2 },
  tenant: { email: "arjun@tenant.in", label: "Tenant", icon: UserRound },
} as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(homeForRole(session.role));

  const { as } = await searchParams;
  const client = await getClient();
  const branded = client.slug !== "pg360";
  // No seeded demo accounts exist in this deployment's MySQL DB (those were
  // Supabase-project-specific), so the "try the demo" panel never applies here.
  const demoMode = false;
  const picked = as && as in DEMO ? DEMO[as as keyof typeof DEMO] : null;

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
          <Logo invert label={client.brandName} logoSrc={client.logoSrc} />
        </div>
        <div className="relative">
          <h2 className="max-w-md font-display text-4xl font-semibold leading-tight tracking-tight">
            {branded
              ? `Welcome back to ${client.brandName}.`
              : "Welcome back. Your whole PG is waiting on one calm screen."}
          </h2>
          <p className="mt-4 max-w-sm text-paper/60">
            Rent, rooms, food and complaints — and a login for every resident.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-paper/50">
            <ShieldCheck className="size-4 text-teal-300" />
            Row-level-secured, multi-tenant by design.
          </div>
        </div>
        <div className="relative text-sm text-paper/40">
          Powered by{" "}
          <a
            href="https://pg360.software"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-paper/60 underline decoration-paper/20 underline-offset-2 transition-colors hover:text-paper"
          >
            PG360 software
          </a>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col items-center justify-start px-5 pb-10 pt-20 sm:px-8 lg:justify-center lg:py-10">
        <Link
          href="/"
          className="absolute left-5 top-5 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink sm:left-8 sm:top-8"
        >
          <ArrowLeft className="size-4" /> Back home
        </Link>

        <div className="w-full max-w-sm">
          <div className="flex justify-center lg:hidden">
            <Logo label={client.brandName} logoSrc={client.logoSrc} size="lg" stacked />
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-ink lg:mt-0">
            Sign in
          </h1>
          <p className="mt-1.5 text-ink-muted">
            {branded
              ? `Welcome back — let's get you into ${client.brandName}.`
              : "Welcome back — let's get you to your dashboard."}
          </p>

          <div className="mt-8">
            <LoginForm
              key={picked?.email ?? "default"}
              initialEmail={picked?.email ?? ""}
              initialPassword={picked ? "demo1234" : ""}
            />
          </div>

          <p className="mt-8 text-center text-xs text-ink-muted lg:hidden">
            Powered by{" "}
            <a
              href="https://pg360.software"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink-soft underline decoration-line underline-offset-2 transition-colors hover:text-ink"
            >
              PG360 software
            </a>
          </p>

          {demoMode && (
            <div className="mt-8">
              <div className="flex items-center gap-3">
                <span className="hairline h-px flex-1" />
                <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                  Try the demo
                </span>
                <span className="hairline h-px flex-1" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(Object.keys(DEMO) as Array<keyof typeof DEMO>).map((k) => {
                  const d = DEMO[k];
                  return (
                    <Link
                      key={k}
                      href={`/login?as=${k}`}
                      className="group flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-3 text-center transition-all hover:-translate-y-0.5 hover:border-clay-300 hover:shadow-soft"
                    >
                      <d.icon className="size-4.5 text-clay-500" />
                      <span className="text-xs font-semibold text-ink">{d.label}</span>
                    </Link>
                  );
                })}
              </div>
              <p className="mt-3 text-center text-xs text-ink-muted">
                Pick a role, then password is{" "}
                <code className="rounded bg-paper-2 px-1.5 py-0.5 font-mono text-ink-soft">
                  demo1234
                </code>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
