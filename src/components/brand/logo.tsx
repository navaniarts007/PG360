"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** The PG360 brand mark. Uses public/pg360-logo.png when present, and falls back
 *  to the built-in glyph if the asset is missing — so branding never breaks. */
export function Mark({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/pg360-logo.png"
        alt="PG360"
        width={36}
        height={36}
        onError={() => setFailed(true)}
        className={cn("size-9 shrink-0 rounded-full object-contain", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-ink text-paper shadow-soft",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none">
        <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.6" opacity="0.35" />
        <path
          d="M12 4.5a7.5 7.5 0 0 1 6.5 3.75"
          stroke="var(--color-clay-400)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="18.5" cy="8.25" r="1.6" fill="var(--color-gold-400)" />
      </svg>
    </span>
  );
}

export function Logo({
  className,
  href = "/",
  invert = false,
  wordmark = true,
  label,
}: {
  className?: string;
  href?: string;
  invert?: boolean;
  wordmark?: boolean;
  /** White-label brand name. Defaults to the PG360 wordmark. */
  label?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <Mark className="transition-transform duration-500 group-hover:rotate-[20deg]" />
      {wordmark && (
        <span
          className={cn(
            "font-display text-[1.35rem] font-medium tracking-tight",
            invert ? "text-paper" : "text-ink",
          )}
        >
          {label ? (
            label
          ) : (
            <>
              PG<span className="text-clay-500">360</span>
            </>
          )}
        </span>
      )}
    </Link>
  );
}
