import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  CheckCircle2,
  LayoutDashboard,
  MessagesSquare,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { WifiCard } from "@/components/marketing/wifi-card";
import { Hero } from "@/components/marketing/hero";
import { BeforeAfter } from "@/components/marketing/before-after";
import { FeatureWeb } from "@/components/marketing/feature-web";
import { DownloadCards } from "@/components/marketing/download-cards";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Marquee />
      <BeforeAfter />
      <FeatureWeb />
      <PortalSpotlight />
      <HowItWorks />
      <Pricing />
      <Downloads />
      <Testimonials />
      <FinalCta />
    </>
  );
}

function SectionIntro({
  label,
  title,
  body,
  align = "left",
}: {
  label: string;
  title: string;
  body?: string;
  align?: "left" | "center";
}) {
  return (
    <Reveal
      blur
      className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}
    >
      <p className="eyebrow text-clay-500">{label}</p>
      <h2 className="section-title mt-4 text-ink">{title}</h2>
      {body ? (
        <p className={cn("section-copy mt-5", align === "center" && "mx-auto")}>
          {body}
        </p>
      ) : null}
    </Reveal>
  );
}

function Marquee() {
  const items = [
    "₹4.8 Cr rent tracked",
    "12,000+ beds managed",
    "98% on-time reminders",
    "Tenant logins included",
    "UPI · Cash · Bank",
    "Built for India 🇮🇳",
  ];
  const row = [...items, ...items];
  return (
    <section className="relative py-4">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-full border border-line/80 bg-paper-2/70 px-1 py-4 shadow-soft [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="flex shrink-0 animate-marquee items-center gap-10 pr-10">
          {row.map((t, i) => (
            <span
              key={i}
              className="flex items-center gap-3 whitespace-nowrap text-sm font-medium text-ink-muted"
            >
              <span className="size-1.5 rounded-full bg-clay-400" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function PortalSpotlight() {
  const perks = [
    {
      icon: Wifi,
      title: "WiFi at a tap",
      body: "No more shouting the password down the corridor.",
    },
    {
      icon: ReceiptText,
      title: "Their bill, itemised",
      body: "Rent, electricity and food — clear, every month.",
    },
    {
      icon: MessagesSquare,
      title: "Raise an issue",
      body: "With a photo, and track it to resolved.",
    },
  ];

  return (
    <section id="portal" className="relative scroll-mt-24 px-4 py-10 sm:px-6">
      <div className="section-shell mx-auto max-w-6xl rounded-[2.1rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_0.95fr]">
          <Reveal blur className="order-2 lg:order-1">
            <div className="relative mx-auto max-w-md">
              <div className="pointer-events-none absolute -left-10 top-12 h-28 w-28 rounded-full border border-line/70" />
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-clay-100/70 blur-2xl" />

              <div className="media-frame rounded-[2rem] p-3">
                <div className="rounded-[1.6rem] bg-paper/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-full bg-clay-500 text-sm font-bold text-white">
                      AN
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">Arjun Nair</p>
                      <p className="text-xs text-ink-muted">
                        Room 201 · Sunrise Stay
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <WifiCard password="Sunrise@201" />
                  </div>

                  <div className="editorial-card mt-4 rounded-[1.4rem] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink">June bill</p>
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[0.7rem] font-semibold text-teal-700 ring-1 ring-teal-100">
                        Paid
                      </span>
                    </div>
                    <p className="tnum mt-2 text-3xl font-semibold text-ink">₹19,850</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Rent ₹16,000 · Power ₹850 · Food ₹3,000
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="order-1 lg:order-2">
            <SectionIntro
              label="The differentiator"
              title="A login for every tenant."
              body="Most PG software stops at the owner. PG360 gives every resident a beautiful little portal — so they stop messaging you for the WiFi password and start self-serving."
            />

            <div className="mt-10 space-y-4">
              {perks.map((p, i) => (
                <Reveal key={p.title} blur delay={i * 70}>
                  <div className="editorial-card hover-card flex gap-4 rounded-[1.45rem] p-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-[1rem] bg-surface text-teal-600 ring-1 ring-line">
                      <p.icon className="size-5" />
                    </span>
                    <div>
                      <p className="text-lg font-medium text-ink">{p.title}</p>
                      <p className="mt-1 text-sm leading-6 text-ink-soft">{p.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: UserRound,
      title: "Sign up",
      body: "Create your owner account in minutes — no card, no sales call.",
    },
    {
      n: "02",
      icon: BedDouble,
      title: "Add your PG",
      body: "Add rooms, beds and rent. Onboard tenants with one click — logins included.",
    },
    {
      n: "03",
      icon: LayoutDashboard,
      title: "Start managing",
      body: "Collect rent, resolve issues and watch your P&L — calm and in control.",
    },
  ];

  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
      <div className="section-shell rounded-[2.1rem] px-6 py-10 sm:px-10 sm:py-14">
        <SectionIntro label="How it works" title="Live in three steps." align="center" />

        <div className="relative mt-14 grid gap-6 md:grid-cols-3">
          <div className="hairline absolute inset-x-16 top-16 hidden h-px md:block" />
          {steps.map((s, i) => (
            <Reveal key={s.n} blur delay={i * 90}>
              <div className="editorial-card hover-card relative rounded-[1.65rem] p-7 text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-[1.3rem] bg-ink text-paper shadow-lift">
                  <s.icon className="size-6" />
                </span>
                <span className="mt-6 block font-mono text-xs font-semibold tracking-[0.35em] text-clay-400">
                  {s.n}
                </span>
                <h3 className="mt-2 text-[1.45rem] text-ink">{s.title}</h3>
                <p className="mt-3 text-sm leading-7 text-ink-soft">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "₹5,000",
      cadence: "/year",
      tagline: "For a single PG getting organised.",
      features: ["1 PG", "Up to 30 beds", "Rooms, tenants & rent", "Tenant portal", "Email support"],
      highlight: false,
    },
    {
      name: "Pro",
      price: "₹8,000",
      cadence: "/year",
      tagline: "For growing PGs that want it all.",
      features: [
        "1 PG",
        "Unlimited beds",
        "Food, expenses & P&L",
        "Reports + CSV export",
        "SMS rent reminders",
        "Priority support",
      ],
      highlight: true,
    },
    {
      name: "Lifetime",
      price: "₹10,000",
      cadence: "once",
      tagline: "Pay once. Yours forever.",
      features: ["Everything in Pro", "One-time payment", "Free updates", "Onboarding call", "WhatsApp support"],
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="relative scroll-mt-24 px-4 py-10 sm:px-6">
      <div className="section-shell mx-auto max-w-6xl rounded-[2.1rem] px-6 py-10 sm:px-10 sm:py-14">
        <SectionIntro
          label="Pricing"
          title="Honest, flat pricing."
          body="No per-tenant fees. No surprises. Cancel anytime."
          align="center"
        />

        <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-3">
          {plans.map((p, i) => (
            <Reveal key={p.name} blur delay={i * 80} className="h-full">
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-[1.8rem] border p-7 transition-all duration-300",
                  p.highlight
                    ? "overflow-hidden border-clay-200 bg-ink text-paper shadow-pop lg:-mt-4 lg:mb-0"
                    : "editorial-card hover-card",
                )}
              >
                {p.highlight ? (
                  <>
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(194,83,29,0.34),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(217,164,65,0.18),transparent_26%)]" />
                    <span className="absolute -top-3 left-7 inline-flex items-center gap-1.5 rounded-full bg-clay-500 px-3 py-1 text-xs font-semibold text-white shadow-soft">
                      <Sparkles className="size-3.5" /> Most popular
                    </span>
                  </>
                ) : null}

                <div className="relative">
                  <h3 className={cn("text-2xl", p.highlight ? "text-paper" : "text-ink")}>{p.name}</h3>
                  <p className={cn("mt-2 text-sm leading-6", p.highlight ? "text-paper/70" : "text-ink-muted")}>
                    {p.tagline}
                  </p>
                  <div className="mt-6 flex items-end gap-1">
                    <span className="tnum font-display text-5xl font-semibold tracking-tight">{p.price}</span>
                    <span className={cn("pb-1 text-sm", p.highlight ? "text-paper/60" : "text-ink-muted")}>
                      {p.cadence}
                    </span>
                  </div>

                  <ul className="mt-7 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm">
                        <CheckCircle2 className={cn("size-4.5 shrink-0", p.highlight ? "text-gold-300" : "text-teal-500")} />
                        <span className={p.highlight ? "text-paper/90" : "text-ink-soft"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto pt-8">
                  <Button asChild className="w-full" variant={p.highlight ? "primary" : "outline"}>
                    <Link href="/login">Choose {p.name}</Link>
                  </Button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Downloads() {
  return (
    <section id="download" className="relative scroll-mt-24 px-4 py-10 sm:px-6">
      <div className="section-shell mx-auto max-w-6xl rounded-[2.1rem] px-6 py-10 sm:px-10 sm:py-14">
        <SectionIntro
          label="Get the app"
          title="PG360, everywhere you work."
          body="Use it in any browser, or install the native app on Android and Windows. Same login, same data — hosted in India 🇮🇳."
          align="center"
        />
        <div className="mx-auto mt-12 max-w-4xl">
          <DownloadCards />
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const quotes = [
    {
      quote:
        "I used to chase 40 tenants on WhatsApp for rent. Now I open one screen and know exactly who's due. The tenant logins alone saved me hours.",
      name: "Ravi Kumar",
      role: "Owner · Sunrise Stay, Bengaluru",
    },
    {
      quote:
        "My residents stopped asking me for the WiFi password. Sounds small — it changed my evenings.",
      name: "Meena Iyer",
      role: "Owner · Green Nest, HSR Layout",
    },
    {
      quote:
        "The P&L view finally told me which of my two PGs actually makes money. Worth it on day one.",
      name: "Imran Shaikh",
      role: "Owner · Metro Boys PG, Mumbai",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <SectionIntro
        label="Proof"
        title="Small moments for tenants. Big relief for owners."
        body="The product still does the boring operational work. The experience just feels calmer and more premium."
      />

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {quotes.map((q, i) => (
          <Reveal key={q.name} blur delay={i * 80}>
            <figure className="editorial-card hover-card flex h-full flex-col rounded-[1.7rem] p-6">
              <div className="flex gap-0.5 text-gold-400">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} />
                ))}
              </div>
              <blockquote className="mt-5 flex-1 font-display text-xl leading-[1.35] text-ink">
                “{q.quote}”
              </blockquote>
              <figcaption className="mt-6 border-t border-line pt-4">
                <p className="text-sm font-semibold text-ink">{q.name}</p>
                <p className="text-xs text-ink-muted">{q.role}</p>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Star() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current">
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
    </svg>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Reveal blur>
        <div className="grain relative overflow-hidden rounded-[2.4rem] bg-ink px-8 py-16 text-center shadow-pop sm:px-16 sm:py-20">
          <div
            className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(194,83,29,0.4), transparent 70%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-16 size-80 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(217,164,65,0.22), transparent 70%)" }}
          />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-paper/80 ring-1 ring-white/15">
              <ShieldCheck className="size-4 text-teal-300" /> RLS-secured · data hosted in India
            </span>
            <h2 className="mx-auto mt-7 max-w-3xl text-balance font-display text-4xl font-semibold tracking-tight text-paper sm:text-6xl">
              Your PG deserves better than a register.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-paper/70">
              Start free today. Add your first PG, onboard tenants, and collect your first rent on
              PG360 this week.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="bg-clay-500 hover:bg-clay-600">
                <Link href="/login">
                  Start free <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/5 text-paper hover:bg-white/10 hover:ring-white/30"
              >
                <Link href="/contact">Talk to us</Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
