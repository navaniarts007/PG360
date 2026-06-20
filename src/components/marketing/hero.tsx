"use client";

import { useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowRight, CheckCircle2, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroPreview } from "@/components/marketing/hero-preview";
import { HeroAtmosphere } from "@/components/marketing/hero-atmosphere";

const PROOF = ["No card required", "Set up in 10 minutes", "RLS-secured data"];

export function Hero() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-rise", {
        y: 22,
        opacity: 0,
        duration: 0.7,
        stagger: 0.09,
      }).from(
        ".hero-preview",
        { y: 36, opacity: 0, duration: 0.9, ease: "power4.out" },
        "-=0.45",
      );
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative overflow-hidden px-4 pt-32 pb-20 sm:px-6 sm:pt-40 sm:pb-28"
    >
      <HeroAtmosphere />

      <div className="section-shell grain relative mx-auto max-w-6xl rounded-[2.25rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="hero-mesh pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute left-10 top-10 h-24 w-24 rounded-full border border-line/80" />
        <div className="pointer-events-none absolute right-8 top-16 h-40 w-40 rounded-full border border-clay-200/70" />

        <div className="relative grid items-center gap-14 lg:grid-cols-[1.02fr_1fr]">
          <div>
            <span className="hero-rise inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-2 text-sm font-medium text-ink-soft shadow-soft backdrop-blur">
              <Sparkles className="size-4 text-clay-500" />
              Built for Indian PG &amp; hostel owners
            </span>

            <h1 className="hero-rise mt-7 max-w-4xl text-balance font-display text-5xl leading-[0.94] font-semibold tracking-[-0.05em] text-ink sm:text-6xl lg:text-[5.4rem]">
              Run your PG like a{" "}
              <span className="font-editorial italic font-normal text-clay-600">
                five-star
              </span>{" "}
              property.
            </h1>

            <p className="hero-rise mt-7 max-w-xl text-lg leading-8 text-ink-soft">
              Rooms, tenants, rent, food, complaints and P&amp;L — in one calm
              dashboard. And every resident gets their own login to see their room,
              WiFi password and bill. No spreadsheets. No chaos.
            </p>

            <div className="hero-rise mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/login">
                  Start free <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#how">
                  <Play className="size-4 fill-current" /> See how it works
                </Link>
              </Button>
            </div>

            <div className="hero-rise mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-muted">
              {PROOF.map((t) => (
                <span key={t} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-teal-500" /> {t}
                </span>
              ))}
            </div>
          </div>

          <div className="hero-preview">
            <HeroPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
