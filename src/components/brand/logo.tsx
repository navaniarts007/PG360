import Link from "next/link";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-ink text-paper shadow-soft",
        className,
      )}
      aria-hidden
    >
      {/* a "360" rotation glyph: a ring with a clay arc, like a key/dial */}
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
}: {
  className?: string;
  href?: string;
  invert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <Mark className="transition-transform duration-500 group-hover:rotate-[20deg]" />
      <span
        className={cn(
          "font-display text-[1.35rem] font-medium tracking-tight",
          invert ? "text-paper" : "text-ink",
        )}
      >
        PG<span className="text-clay-500">360</span>
      </span>
    </Link>
  );
}
