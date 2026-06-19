"use client";

import { BedDouble, IndianRupee, Users, type LucideIcon } from "lucide-react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { WifiCard } from "@/components/marketing/wifi-card";
import { CountUp } from "@/components/marketing/count-up";
import { cn, inrCompact } from "@/lib/utils";

interface Kpi {
  label: string;
  value: number;
  format: (n: number) => string;
  tone: string;
  icon: LucideIcon;
}

export function HeroPreview() {
  const reduced = useReducedMotion();

  const kpis: Kpi[] = [
    { label: "Tenants", value: 42, format: (n) => String(Math.round(n)), tone: "text-ink", icon: Users },
    { label: "Occupancy", value: 88, format: (n) => `${Math.round(n)}%`, tone: "text-teal-600", icon: BedDouble },
    { label: "Collected", value: 486500, format: inrCompact, tone: "text-clay-600", icon: IndianRupee },
  ];
  const due = [
    { name: "Karthik Reddy", room: "101", amt: "₹12,600" },
    { name: "Aisha Khan", room: "202", amt: "₹13,200" },
    { name: "Faisal Ahmed", room: "301", amt: "₹8,950" },
  ];

  // cursor-driven 3D tilt on the dashboard card
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 150, damping: 16 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 150, damping: 16 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const handleLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      className="relative animate-rise [animation-delay:0.25s]"
      style={{ perspective: 1100 }}
    >
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] opacity-60 blur-2xl"
        style={{ background: "radial-gradient(40% 60% at 60% 20%, rgba(217,164,65,0.25), transparent)" }}
      />
      {/* main dashboard card */}
      <motion.div
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={reduced ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="rounded-[1.6rem] border border-line bg-surface/80 p-4 shadow-pop backdrop-blur-xl sm:p-5"
      >
        <div className="flex items-center justify-between px-1 pb-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-rose-300" />
            <span className="size-2.5 rounded-full bg-gold-300" />
            <span className="size-2.5 rounded-full bg-teal-300" />
          </div>
          <span className="text-xs font-medium text-ink-muted">Sunrise Stay · June</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-line bg-paper/60 p-3">
              <k.icon className="size-4 text-ink-muted" />
              <p className={cn("mt-2 text-xl font-semibold tnum", k.tone)}>
                <CountUp value={k.value} format={k.format} />
              </p>
              <p className="text-[0.7rem] text-ink-muted">{k.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-line bg-paper/60 p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Payments due</p>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[0.7rem] font-semibold text-rose-600 ring-1 ring-rose-100">
              3 pending
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            {due.map((d) => (
              <div key={d.name} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-full bg-clay-50 text-[0.7rem] font-bold text-clay-600">
                    {d.room}
                  </span>
                  <span className="text-ink-soft">{d.name}</span>
                </span>
                <span className="font-semibold text-ink tnum">{d.amt}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* floating WiFi card — the differentiator */}
      <div className="absolute -bottom-8 -left-6 w-60 animate-float sm:-left-10 sm:w-72">
        <WifiCard password="Sunrise@201" />
      </div>
    </div>
  );
}
