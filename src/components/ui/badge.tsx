import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "clay"
  | "teal"
  | "gold"
  | "rose"
  | "open"
  | "progress"
  | "resolved";

const tones: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-soft ring-line-strong",
  clay: "bg-clay-50 text-clay-700 ring-clay-100",
  teal: "bg-teal-50 text-teal-700 ring-teal-100",
  gold: "bg-gold-50 text-gold-600 ring-gold-100",
  rose: "bg-rose-50 text-rose-600 ring-rose-100",
  open: "bg-rose-50 text-rose-600 ring-rose-100",
  progress: "bg-gold-50 text-gold-600 ring-gold-100",
  resolved: "bg-teal-50 text-teal-700 ring-teal-100",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot = false,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
