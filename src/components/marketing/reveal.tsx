"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Scroll-triggered reveal. Respects prefers-reduced-motion via CSS. */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
  blur = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: React.ElementType;
  blur?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        shown
          ? "translate-y-0 scale-100 opacity-100 blur-0"
          : cn("translate-y-8 scale-[0.985] opacity-0", blur && "blur-[6px]"),
        className,
      )}
    >
      {children}
    </Tag>
  );
}
