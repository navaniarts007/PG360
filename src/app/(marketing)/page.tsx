import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  CheckCircle2,
  LayoutDashboard,
  type LucideIcon,
  MessagesSquare,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Utensils,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { WifiCard } from "@/components/marketing/wifi-card";
import { HeroPreview } from "@/components/marketing/hero-preview";
import { HeroAtmosphere } from "@/components/marketing/hero-atmosphere";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Marquee />
      <Features />
      <PortalSpotlight />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FinalCta />
    </>
  );
}

/* ------------------------------------------------------------------ Hero */

function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24">
      {/* atmosphere (parallax) */}
      <HeroAtmosphere />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="stagger">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-sm font-medium text-ink-soft shadow-soft backdrop-blur">
            <Sparkles className="size-4 text-clay-500" />
            Built for Indian PG &amp; hostel owners
          </span>

          <h1 className="mt-6 text-balance font-display text-5xl leading-[0.98] font-semibold tracking-tight text-ink sm:text-6xl lg:text-[4.4rem]">
            Run your PG like a
            <span className="relative whitespace-nowrap">
              {" "}
              <span className="clay-text italic">five-star</span>
            </span>{" "}
            property.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            Rooms, tenants, rent, food, complaints and P&amp;L — in one calm
            dashboard. And every resident gets their own login to see their room,
            WiFi password and bill. No spreadsheets. No chaos.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Start free <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">See a live demo</Link>
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-muted">
            {["No card required", "Set up in 10 minutes", "RLS-secured data"].map(
              (t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-teal-500" /> {t}
                </span>
              ),
            )}
          </div>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Marquee */

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
    <section className="relative border-y border-line bg-paper-2/50 py-5">
      <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
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

/* -------------------------------------------------------------- Features */

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  tone: string;
  span?: string;
}

function Features() {
  const features: Feature[] = [
    {
      icon: BedDouble,
      title: "Rooms & beds",
      body: "Track every room, bed and floor with live vacant / partial / occupied status that updates as tenants move in and out.",
      tone: "text-clay-600",
      span: "lg:col-span-2",
    },
    {
      icon: Users,
      title: "Tenants & KYC",
      body: "Onboard residents with Aadhaar, deposit and check-in date — each gets their own login automatically.",
      tone: "text-teal-600",
    },
    {
      icon: ReceiptText,
      title: "Rent & dues",
      body: "Record rent with an electricity + food + other breakdown. See exactly who paid and who is due this month.",
      tone: "text-clay-600",
    },
    {
      icon: Utensils,
      title: "Food & mess",
      body: "Weekly menus and per-meal opt in / out that flows straight into each tenant's monthly bill.",
      tone: "text-gold-600",
    },
    {
      icon: MessagesSquare,
      title: "Complaints",
      body: "Tenants raise issues with photos; you triage open → in-progress → resolved without the WhatsApp mess.",
      tone: "text-teal-600",
    },
    {
      icon: TrendingUp,
      title: "P&L & reports",
      body: "Collected minus expenses, occupancy and turnover — exportable, so you always know your real profit.",
      tone: "text-clay-600",
      span: "lg:col-span-2",
    },
  ];

  return (
    <section id="features" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
      <Reveal className="max-w-2xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-clay-500">
          Everything in one place
        </p>
        <h2 className="mt-3 text-balance font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          The whole PG, finally on one screen.
        </h2>
        <p className="mt-4 text-lg text-ink-soft">
          Six tightly-built modules replace your registers, spreadsheets and a
          dozen WhatsApp groups.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 60} className={f.span}>
            <article className="group h-full rounded-2xl border border-line bg-surface p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
              <span className="inline-grid size-11 place-items-center rounded-xl bg-paper-2 ring-1 ring-line transition-colors group-hover:bg-clay-50">
                <f.icon className={cn("size-5.5", f.tone)} />
              </span>
              <h3 className="mt-4 text-xl text-ink">{f.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">
                {f.body}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------- Portal spotlight */

function PortalSpotlight() {
  const perks = [
    { icon: Wifi, title: "WiFi at a tap", body: "No more shouting the password down the corridor." },
    { icon: ReceiptText, title: "Their bill, itemised", body: "Rent, electricity and food — clear, every month." },
    { icon: MessagesSquare, title: "Raise an issue", body: "With a photo, and track it to resolved." },
  ];
  return (
    <section id="portal" className="relative scroll-mt-24 overflow-hidden py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal className="order-2 lg:order-1">
          <div className="relative mx-auto max-w-sm">
            <div
              className="pointer-events-none absolute -inset-8 -z-10 rounded-full opacity-70 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(33,28,21,0.12), transparent 70%)" }}
            />
            {/* phone-ish frame */}
            <div className="rounded-[2rem] border border-line bg-surface p-3 shadow-pop">
              <div className="rounded-[1.5rem] bg-paper p-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-full bg-clay-500 text-sm font-bold text-white">
                    AN
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Arjun Nair</p>
                    <p className="text-xs text-ink-muted">Room 201 · Sunrise Stay</p>
                  </div>
                </div>
                <div className="mt-4">
                  <WifiCard password="Sunrise@201" />
                </div>
                <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">June bill</p>
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[0.7rem] font-semibold text-teal-700 ring-1 ring-teal-100">
                      Paid
                    </span>
                  </div>
                  <p className="mt-1 text-2xl font-semibold text-ink tnum">₹19,850</p>
                  <p className="text-xs text-ink-muted">Rent ₹16,000 · Power ₹850 · Food ₹3,000</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal className="order-1 lg:order-2" delay={80}>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">
            The differentiator
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            A login for every tenant.
          </h2>
          <p className="mt-4 text-lg text-ink-soft">
            Most PG software stops at the owner. PG360 gives every resident a
            beautiful little portal — so they stop messaging you for the WiFi
            password and start self-serving.
          </p>
          <ul className="mt-8 space-y-4">
            {perks.map((p) => (
              <li key={p.title} className="flex gap-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-teal-600 shadow-soft ring-1 ring-line">
                  <p.icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold text-ink">{p.title}</p>
                  <p className="text-sm text-ink-soft">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- How it works */

function HowItWorks() {
  const steps = [
    { n: "01", icon: UserRound, title: "Sign up", body: "Create your owner account in minutes — no card, no sales call." },
    { n: "02", icon: BedDouble, title: "Add your PG", body: "Add rooms, beds and rent. Onboard tenants with one click — logins included." },
    { n: "03", icon: LayoutDashboard, title: "Start managing", body: "Collect rent, resolve issues and watch your P&L — calm and in control." },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-clay-500">
          How it works
        </p>
        <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Live in three steps.
        </h2>
      </Reveal>

      <div className="relative mt-14 grid gap-6 md:grid-cols-3">
        <div className="hairline absolute inset-x-12 top-12 hidden h-px md:block" />
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 90}>
            <div className="relative rounded-2xl border border-line bg-surface p-7 text-center shadow-soft">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ink text-paper shadow-lift">
                <s.icon className="size-6" />
              </span>
              <span className="mt-5 block font-mono text-xs font-semibold tracking-widest text-clay-400">
                {s.n}
              </span>
              <h3 className="mt-1 text-xl text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Pricing */

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
      features: ["1 PG", "Unlimited beds", "Food, expenses & P&L", "Reports + CSV export", "SMS rent reminders", "Priority support"],
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
    <section id="pricing" className="relative scroll-mt-24 overflow-hidden py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-clay-500">
            Pricing
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Honest, flat pricing.
          </h2>
          <p className="mt-4 text-lg text-ink-soft">
            No per-tenant fees. No surprises. Cancel anytime.
          </p>
        </Reveal>

        <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-3">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={i * 80} className="h-full">
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border p-7 transition-all duration-300",
                  p.highlight
                    ? "border-clay-200 bg-ink text-paper shadow-pop lg:-mt-4 lg:mb-0"
                    : "border-line bg-surface shadow-soft hover:-translate-y-1 hover:shadow-lift",
                )}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-7 inline-flex items-center gap-1.5 rounded-full bg-clay-500 px-3 py-1 text-xs font-semibold text-white shadow-soft">
                    <Sparkles className="size-3.5" /> Most popular
                  </span>
                )}
                <h3 className={cn("text-xl", p.highlight ? "text-paper" : "text-ink")}>
                  {p.name}
                </h3>
                <p className={cn("mt-1 text-sm", p.highlight ? "text-paper/70" : "text-ink-muted")}>
                  {p.tagline}
                </p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="font-display text-4xl font-semibold tracking-tight tnum">
                    {p.price}
                  </span>
                  <span className={cn("pb-1 text-sm", p.highlight ? "text-paper/60" : "text-ink-muted")}>
                    {p.cadence}
                  </span>
                </div>

                <ul className="mt-6 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2
                        className={cn(
                          "size-4.5 shrink-0",
                          p.highlight ? "text-gold-300" : "text-teal-500",
                        )}
                      />
                      <span className={p.highlight ? "text-paper/90" : "text-ink-soft"}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-7">
                  <Button
                    asChild
                    className="w-full"
                    variant={p.highlight ? "primary" : "outline"}
                  >
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

/* ----------------------------------------------------------- Testimonials */

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
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-5 md:grid-cols-3">
        {quotes.map((q, i) => (
          <Reveal key={q.name} delay={i * 80}>
            <figure className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-soft">
              <div className="flex gap-0.5 text-gold-400">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 font-display text-lg leading-snug text-ink">
                “{q.quote}”
              </blockquote>
              <figcaption className="mt-5 border-t border-line pt-4">
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

/* -------------------------------------------------------------- Final CTA */

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Reveal>
        <div className="grain relative overflow-hidden rounded-[2rem] bg-ink px-8 py-16 text-center shadow-pop sm:px-16 sm:py-20">
          <div
            className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(194,83,29,0.4), transparent 70%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-16 size-80 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(217,164,65,0.22), transparent 70%)" }}
          />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-paper/80 ring-1 ring-white/15">
              <ShieldCheck className="size-4 text-teal-300" /> RLS-secured · multi-tenant by design
            </span>
            <h2 className="mx-auto mt-6 max-w-2xl text-balance font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
              Your PG deserves better than a register.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-paper/70">
              Start free today. Add your first PG, onboard tenants, and collect
              your first rent on PG360 this week.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
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
                <Link href="/login">Talk to us</Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
