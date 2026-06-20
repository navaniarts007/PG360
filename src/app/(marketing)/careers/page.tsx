import type { Metadata } from "next";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";
import { CONTACT } from "@/lib/site";

export const metadata: Metadata = { title: "Careers" };

export default function CareersPage() {
  return (
    <>
      <PageHero
        eyebrow="Careers"
        title="Build the future of"
        accent="PG living"
        subtitle="We're a small, India-based team building calm, premium software for thousands of PG owners. No open roles listed yet — but we always meet great people."
      />
      <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <Reveal blur>
          <div className="section-shell flex flex-col items-center gap-4 rounded-[2rem] px-6 py-14 text-center sm:px-10">
            <span className="grid size-14 place-items-center rounded-2xl bg-paper ring-1 ring-line">
              <Rocket className="size-7 text-clay-600" />
            </span>
            <h2 className="font-display text-2xl text-ink">Like what we&apos;re building?</h2>
            <p className="max-w-md text-sm leading-7 text-ink-soft">
              Send us a note about how you&apos;d like to contribute — engineering, design,
              or growth. If there&apos;s a fit, we&apos;ll reach out.
            </p>
            <Button asChild>
              <Link href={`mailto:${CONTACT.emails[0]}`}>Introduce yourself</Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
