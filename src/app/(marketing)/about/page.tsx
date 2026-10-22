import type { Metadata } from "next";
import Link from "next/link";
import { Heart, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "About",
  description:
    "PG360 is the operating system for PG and hostel owners in India — built to make running a property calm, modern and profitable.",
};

const values = [
  {
    icon: Heart,
    title: "Owner-first",
    body: "Every feature starts from a real PG owner's day — chasing rent, fixing a geyser, knowing the P&L.",
  },
  {
    icon: Sparkles,
    title: "Calm by design",
    body: "Software should feel premium and quiet, not like a spreadsheet that fights back.",
  },
  {
    icon: ShieldCheck,
    title: "Trust & residency",
    body: "Row-level security on every table, and your data hosted in India (Mumbai).",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Our story"
        title="Built for the people who run"
        accent="India's PGs"
        subtitle="PG360 began with a simple frustration: running a PG meant registers, a dozen WhatsApp groups and guesswork. We thought owners deserved better — so we built the calm operating system we wished existed."
      />

      <section className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        <Reveal blur>
          <div className="section-shell rounded-[2rem] px-6 py-10 sm:px-10 sm:py-12">
            <p className="text-[1.05rem] leading-8 text-ink-soft">
              PG360 brings rooms, beds, tenants, rent, food, complaints and P&amp;L into one
              place — and gives every resident their own login for their room, WiFi and bill.
              No spreadsheets. No chaos. Just a property that runs like a five-star stay.
            </p>
            <p className="mt-4 text-[1.05rem] leading-8 text-ink-soft">
              We&apos;re a small, India-based team obsessed with the details that make owners&apos;
              evenings quieter and their tenants happier.
            </p>
            <p className="mt-6 inline-flex items-center gap-2 text-sm text-ink-muted">
              <MapPin className="size-4" /> Made in India 🇮🇳 · Data hosted in Mumbai
            </p>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {values.map((v, i) => (
            <Reveal key={v.title} blur delay={i * 70}>
              <div className="editorial-card hover-card h-full rounded-[1.65rem] p-6">
                <span className="inline-grid size-12 place-items-center rounded-[1.1rem] bg-paper ring-1 ring-line">
                  <v.icon className="size-6 text-clay-600" />
                </span>
                <h3 className="mt-5 text-[1.3rem] text-ink">{v.title}</h3>
                <p className="mt-2 text-[0.97rem] leading-7 text-ink-soft">{v.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal blur delay={240}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact">Talk to us</Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
