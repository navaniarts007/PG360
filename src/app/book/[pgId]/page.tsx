import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { BookingForm } from "@/components/marketing/booking-form";
import { getPublicPg } from "@/lib/db";

export const metadata: Metadata = { title: "Request a room" };

export default async function BookPage({
  params,
}: {
  params: Promise<{ pgId: string }>;
}) {
  const { pgId } = await params;
  const pg = await getPublicPg(pgId);
  if (!pg) notFound();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="dotgrid pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(70%_50%_at_50%_0%,black,transparent)]" />
      <div className="grain pointer-events-none absolute inset-0" />
      <div
        className="pointer-events-none absolute -top-40 right-[-10%] size-[34rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(194,83,29,0.14), transparent 65%)" }}
      />

      <header className="relative mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo href="/" />
        <Link href="/" className="text-sm font-medium text-ink-muted hover:text-ink">
          Powered by PG360
        </Link>
      </header>

      <main className="relative mx-auto max-w-lg px-4 pb-20 pt-8 sm:px-6">
        <div className="text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-clay-500">
            Room enquiry
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">
            {pg.pg_name}
          </h1>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-muted">
            <MapPin className="size-3.5" /> {pg.location}
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-lift sm:p-8">
          {pg.status === "active" ? (
            <BookingForm pgId={pgId} />
          ) : (
            <p className="text-center text-sm text-ink-muted">
              This PG isn&apos;t accepting new requests right now.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
