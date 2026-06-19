import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** The PG360 brand mark (circular logo). Sits on any background — the asset has
 *  its own white disc. Replace public/pg360-logo.png to change it everywhere. */
export function Mark({ className }: { className?: string }) {
  return (
    <Image
      src="/pg360-logo.png"
      alt="PG360"
      width={40}
      height={40}
      priority
      className={cn("size-9 shrink-0 rounded-full object-contain", className)}
    />
  );
}

export function Logo({
  className,
  href = "/",
  invert = false,
  wordmark = true,
}: {
  className?: string;
  href?: string;
  invert?: boolean;
  wordmark?: boolean;
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
          PG<span className="text-clay-500">360</span>
        </span>
      )}
    </Link>
  );
}
