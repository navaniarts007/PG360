"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#how", label: "How it works" },
  { href: "/download", label: "Download" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 transition-all duration-300 sm:px-6",
          scrolled
            ? "mt-3 rounded-[1.55rem] border border-line/90 bg-paper/75 py-2.5 shadow-lift backdrop-blur-2xl sm:mx-4 lg:mx-auto"
            : "mt-0 border-transparent py-5",
        )}
      >
        <Logo />

        <nav className="hidden items-center gap-1 rounded-full border border-line/80 bg-surface/70 p-1 shadow-soft md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="luxe-link rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition-all duration-300 hover:bg-paper hover:text-ink"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Start free</Link>
          </Button>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="grid size-10 place-items-center rounded-xl border border-line/70 bg-surface/70 text-ink shadow-soft md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="section-shell mx-3 mt-2 rounded-[1.6rem] p-3 shadow-lift backdrop-blur-xl md:hidden">
          <nav className="flex flex-col">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Start free</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
