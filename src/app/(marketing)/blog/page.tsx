import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = { title: "Blog" };

export default function BlogPage() {
  return (
    <>
      <PageHero
        eyebrow="Blog"
        title="Notes on running"
        accent="better PGs"
        subtitle="Playbooks on rent collection, tenant experience and running a profitable PG — coming soon."
      />
      <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <Reveal blur>
          <div className="section-shell flex flex-col items-center gap-4 rounded-[2rem] px-6 py-14 text-center sm:px-10">
            <span className="grid size-14 place-items-center rounded-2xl bg-paper ring-1 ring-line">
              <Newspaper className="size-7 text-clay-600" />
            </span>
            <h2 className="font-display text-2xl text-ink">First posts are on the way</h2>
            <p className="max-w-md text-sm leading-7 text-ink-soft">
              We&apos;re writing practical guides for PG owners. Want a topic covered, or early
              access? Tell us.
            </p>
            <Button asChild>
              <Link href="/contact">Suggest a topic</Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
