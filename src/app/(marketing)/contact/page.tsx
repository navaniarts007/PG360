import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";
import { CONTACT } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Talk to the PG360 team — call, WhatsApp or email. We reply fast.",
};

export default function ContactPage() {
  const cards = [
    {
      icon: MessageCircle,
      title: "WhatsApp",
      value: CONTACT.phone,
      href: CONTACT.whatsapp,
      cta: "Chat on WhatsApp",
      tone: "text-teal-600",
    },
    {
      icon: Phone,
      title: "Call us",
      value: CONTACT.phone,
      href: CONTACT.tel,
      cta: "Call now",
      tone: "text-clay-600",
    },
    {
      icon: Mail,
      title: "Email",
      value: CONTACT.emails[0],
      href: `mailto:${CONTACT.emails[0]}`,
      cta: "Send an email",
      tone: "text-gold-600",
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="We'd love to"
        accent="hear from you"
        subtitle="Questions, a demo, or help getting set up — reach us any way you like. We usually reply within a few hours."
      />

      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {cards.map((c, i) => (
            <Reveal key={c.title} blur delay={i * 70}>
              <a
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="editorial-card hover-card flex h-full flex-col rounded-[1.65rem] p-6"
              >
                <span className="inline-grid size-12 place-items-center rounded-[1.1rem] bg-paper ring-1 ring-line">
                  <c.icon className={`size-6 ${c.tone}`} />
                </span>
                <h3 className="mt-5 text-[1.3rem] text-ink">{c.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{c.value}</p>
                <span className="mt-auto pt-6 text-sm font-semibold text-clay-600">
                  {c.cta} →
                </span>
              </a>
            </Reveal>
          ))}
        </div>

        <Reveal blur delay={240}>
          <div className="section-shell mt-6 flex flex-col gap-3 rounded-[1.65rem] px-6 py-6 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2">
              <Mail className="size-4 text-ink-muted" /> Also at{" "}
              <a className="font-medium text-clay-600" href={`mailto:${CONTACT.emails[1]}`}>
                {CONTACT.emails[1]}
              </a>
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="size-4 text-ink-muted" /> Bengaluru, India · Asia/Kolkata
            </span>
          </div>
        </Reveal>
      </section>
    </>
  );
}
