import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const cols = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Tenant portal", href: "#portal" },
      { label: "Pricing", href: "#pricing" },
      { label: "How it works", href: "#how" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "Refund policy", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-line bg-paper-2/60">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
            The operating system for PG &amp; hostel owners in India. Rooms, rent,
            food, complaints and P&amp;L — calm and in control.
          </p>
          <div className="mt-5 flex gap-2">
            <a
              href="tel:+919000000001"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-clay-600"
            >
              <Phone className="size-4" /> Call us
            </a>
            <a
              href="https://wa.me/919000000001"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-teal-600"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          </div>
        </div>

        {cols.map((col) => (
          <div key={col.title}>
            <h4 className="font-display text-sm font-semibold tracking-wide text-ink uppercase">
              {col.title}
            </h4>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-ink-muted transition-colors hover:text-clay-600"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} PG360. Made in India 🇮🇳</p>
          <p className="tnum">GST-ready invoices · UPI &amp; bank · Asia/Kolkata</p>
        </div>
      </div>
    </footer>
  );
}
