import { cn } from "@/lib/utils";
import { Slot } from "./slot";

type Variant = "primary" | "ink" | "outline" | "ghost" | "soft" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-xl transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none select-none active:translate-y-px";

const variants: Record<Variant, string> = {
  primary:
    "bg-clay-600 text-white shadow-soft hover:bg-clay-700 hover:shadow-lift [box-shadow:inset_0_1px_0_rgba(255,255,255,0.18),var(--shadow-soft)]",
  ink: "bg-ink text-paper hover:bg-ink-soft shadow-soft",
  outline:
    "bg-surface/60 text-ink ring-1 ring-line-strong hover:ring-clay-300 hover:bg-surface",
  ghost: "text-ink-soft hover:text-ink hover:bg-paper-2",
  soft: "bg-clay-50 text-clay-700 hover:bg-clay-100 ring-1 ring-clay-100",
  danger: "bg-rose-500 text-white hover:bg-rose-600 shadow-soft",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base [height:3.25rem]",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
