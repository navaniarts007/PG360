"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  BedDouble,
  CalendarCheck,
  type LucideIcon,
  MessagesSquare,
  ReceiptText,
  TrendingUp,
  Users,
  Utensils,
  Zap,
} from "lucide-react";

interface Node {
  icon: LucideIcon;
  label: string;
  tone: string;
}

const NODES: Node[] = [
  { icon: BedDouble, label: "Rooms & beds", tone: "text-clay-600" },
  { icon: Users, label: "Tenants & logins", tone: "text-teal-600" },
  { icon: ReceiptText, label: "Rent & UPI", tone: "text-gold-600" },
  { icon: Utensils, label: "Food & mess", tone: "text-teal-600" },
  { icon: Zap, label: "Electricity", tone: "text-gold-600" },
  { icon: MessagesSquare, label: "Complaints", tone: "text-clay-600" },
  { icon: TrendingUp, label: "P&L & reports", tone: "text-teal-600" },
  { icon: CalendarCheck, label: "Bookings", tone: "text-clay-600" },
];

const C = 50;
const R = 39;
const point = (i: number, r: number) => {
  const a = (-90 + i * (360 / NODES.length)) * (Math.PI / 180);
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};

const outer = NODES.map((_, i) => point(i, R));
const inner = NODES.map((_, i) => point(i, R / 2));
const ringPath = (pts: { x: number; y: number }[]) =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ") + " Z";

export function FeatureWeb() {
  const reduce = useReducedMotion();

  const draw = (delay: number) =>
    reduce
      ? { initial: { pathLength: 1, opacity: 0.5 }, animate: { pathLength: 1, opacity: 0.5 } }
      : {
          initial: { pathLength: 0, opacity: 0 },
          whileInView: { pathLength: 1, opacity: 1 },
          transition: { duration: 0.9, delay, ease: "easeInOut" as const },
        };

  return (
    <section id="features" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
      <div className="section-shell rounded-[2.1rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-clay-500">Everything connected</p>
          <h2 className="section-title mt-4 text-ink">
            One platform, every part of your{" "}
            <span className="font-editorial italic font-normal text-clay-600">PG</span>.
          </h2>
          <p className="section-copy mx-auto mt-5">
            Rooms, tenants, money, food, complaints and reports — all wired into a single
            web, so nothing falls through the cracks.
          </p>
        </div>

        {/* --- desktop / tablet: the spiderweb --- */}
        <div className="relative mx-auto mt-12 hidden aspect-square w-full max-w-xl sm:block">
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-hidden
          >
            <motion.path {...draw(0.5)} d={ringPath(outer)} fill="none" stroke="var(--color-line-strong)" strokeWidth="0.3" />
            <motion.path {...draw(0.65)} d={ringPath(inner)} fill="none" stroke="var(--color-line-strong)" strokeWidth="0.3" />
            {outer.map((p, i) => (
              <motion.path
                key={i}
                {...draw(0.1 + i * 0.06)}
                d={`M${C} ${C} L${p.x} ${p.y}`}
                fill="none"
                stroke="var(--color-clay-400)"
                strokeWidth="0.35"
              />
            ))}
          </svg>

          {/* hub */}
          <motion.div
            initial={reduce ? false : { scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="grid size-24 place-items-center rounded-full bg-ink text-paper shadow-pop">
              <span className="font-display text-xl font-semibold tracking-tight">
                PG <span className="text-clay-400">360</span>
              </span>
            </div>
          </motion.div>

          {/* nodes */}
          {NODES.map((n, i) => {
            const p = outer[i]!;
            return (
              <motion.div
                key={n.label}
                initial={reduce ? false : { scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.55 + i * 0.07, type: "spring", stiffness: 240, damping: 18 }}
                whileHover={{ scale: 1.06 }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                <div className="editorial-card hover-card flex items-center gap-2 rounded-full py-2 pl-2 pr-3.5 shadow-soft">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper ring-1 ring-line">
                    <n.icon className={`size-4.5 ${n.tone}`} />
                  </span>
                  <span className="whitespace-nowrap text-sm font-semibold text-ink">
                    {n.label}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* --- mobile: clean animated grid --- */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:hidden">
          {NODES.map((n, i) => (
            <motion.div
              key={n.label}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
              className="editorial-card flex flex-col gap-2 rounded-2xl p-4"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-paper ring-1 ring-line">
                <n.icon className={`size-5 ${n.tone}`} />
              </span>
              <span className="text-sm font-semibold text-ink">{n.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
