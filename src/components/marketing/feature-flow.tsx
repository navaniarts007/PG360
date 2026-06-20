"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  BedDouble,
  ClipboardList,
  type LucideIcon,
  MessagesSquare,
  ReceiptText,
  TrendingUp,
  UserRound,
  Utensils,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
  tone: string;
}

const STEPS: Step[] = [
  {
    icon: ClipboardList,
    title: "Set up your PG",
    body: "Create your account, add floors and a rate card — pricing flows everywhere from here.",
    tone: "text-clay-600",
  },
  {
    icon: BedDouble,
    title: "Rooms & beds",
    body: "Add rooms; beds are created and priced automatically with live vacant / occupied status.",
    tone: "text-teal-600",
  },
  {
    icon: UserRound,
    title: "Tenants get logins",
    body: "Onboard residents in one step — each gets their own portal for room, WiFi and bill.",
    tone: "text-clay-600",
  },
  {
    icon: ReceiptText,
    title: "Rent & UPI pay",
    body: "Pro-rata first month, one-tap UPI, screenshots you verify — you always know who's due.",
    tone: "text-gold-600",
  },
  {
    icon: Utensils,
    title: "Food & electricity",
    body: "Food included by default with opt-out, plus per-unit electricity — straight onto the bill.",
    tone: "text-teal-600",
  },
  {
    icon: MessagesSquare,
    title: "Complaints",
    body: "Tenants raise issues with photos; you move them open → in-progress → resolved.",
    tone: "text-clay-600",
  },
  {
    icon: TrendingUp,
    title: "P&L & reports",
    body: "Collected minus expenses, occupancy and the revenue gap — your real profit, any month.",
    tone: "text-gold-600",
  },
];

export function FeatureFlow() {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.to(".flow-progress", {
        scaleY: 1,
        ease: "none",
        scrollTrigger: {
          trigger: track.current,
          start: "top 65%",
          end: "bottom 75%",
          scrub: true,
        },
      });
      gsap.from(".flow-step", {
        y: 26,
        opacity: 0,
        duration: 0.6,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: track.current, start: "top 72%" },
      });
    },
    { scope: root },
  );

  return (
    <section id="features" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
      <div ref={root} className="section-shell rounded-[2.1rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="eyebrow text-clay-500">How it all flows</p>
          <h2 className="section-title mt-4 text-ink">
            One calm flow, from{" "}
            <span className="font-editorial italic font-normal text-clay-600">
              setup to profit
            </span>
            .
          </h2>
          <p className="section-copy mt-5">
            Every PG360 module connects into a single operating flow — no registers,
            spreadsheets, or a dozen WhatsApp groups.
          </p>
        </div>

        <div ref={track} className="relative mt-14 pl-2">
          {/* timeline track */}
          <div className="pointer-events-none absolute bottom-2 left-[1.85rem] top-2 w-px bg-line sm:left-[2.1rem]" />
          <div className="flow-progress pointer-events-none absolute bottom-2 left-[1.85rem] top-2 w-px origin-top scale-y-0 bg-gradient-to-b from-clay-400 to-gold-400 sm:left-[2.1rem]" />

          <ol className="space-y-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flow-step relative flex gap-5 sm:gap-7">
                <span className="relative z-10 grid size-[3.7rem] shrink-0 place-items-center rounded-2xl border border-line bg-surface shadow-soft sm:size-16">
                  <s.icon className={`size-6 ${s.tone}`} />
                </span>
                <div className="editorial-card hover-card flex-1 rounded-[1.5rem] p-5 sm:p-6">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold tracking-[0.3em] text-clay-400">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-[1.3rem] leading-tight text-ink">{s.title}</h3>
                  </div>
                  <p className="mt-2 text-[0.97rem] leading-7 text-ink-soft">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
