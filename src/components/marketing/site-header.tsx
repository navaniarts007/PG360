"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#portal", label: "Tenant portal" },
  { href: "#pricing", label: "Pricing" },
  { href: "#how", label: "How it works" },
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
            ? "mt-2.5 rounded-2xl border border-line bg-paper/80 py-2.5 shadow-soft backdrop-blur-xl sm:mx-4 lg:mx-auto"
            : "mt-0 border-transparent py-4",
        )}
      >
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
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
            <Link href="/login">Start free</Link>
          </Button>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="grid size-10 place-items-center rounded-xl text-ink md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="mx-3 mt-2 rounded-2xl border border-line bg-paper/95 p-3 shadow-lift backdrop-blur-xl md:hidden">
          <nav className="flex flex-col">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-paper-2"
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
              <Link href="/login">Start free</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
