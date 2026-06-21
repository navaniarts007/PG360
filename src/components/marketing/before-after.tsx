"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  FileWarning,
  MessageSquareWarning,
  Notebook,
  PhoneOff,
  ReceiptText,
  TrendingUp,
  Wifi,
} from "lucide-react";

const BEFORE = [
  { icon: Notebook, label: "Paper rent register", rot: "-6deg" },
  { icon: MessageSquareWarning, label: "12 WhatsApp groups", rot: "4deg" },
  { icon: PhoneOff, label: "“Bhaiya, WiFi password?”", rot: "-3deg" },
  { icon: FileWarning, label: "Who paid? Who's due?", rot: "5deg" },
  { icon: AlertTriangle, label: "No idea of real profit", rot: "-5deg" },
];

const AFTER = [
  { icon: BedDouble, label: "Every bed tracked live" },
  { icon: ReceiptText, label: "Rent & UPI, auto-reconciled" },
  { icon: Wifi, label: "Tenants self-serve their portal" },
  { icon: TrendingUp, label: "P&L at a glance" },
];

export function BeforeAfter() {
  const [after, setAfter] = useState(false);
  const reduce = useReducedMotion();

  return (
    <section className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="section-shell grain relative overflow-hidden rounded-[2.1rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow text-clay-500">The story</p>
          <h2 className="section-title mt-4 text-ink">
            From{" "}
            <span className="font-editorial italic font-normal text-rose-500">chaos</span>{" "}
            to{" "}
            <span className="font-editorial italic font-normal text-teal-600">calm</span>.
          </h2>
          <p className="section-copy mx-auto mt-5">
            Every PG owner knows the registers, the WhatsApp chaos, the month-end guesswork.
            PG360 turns all of it into one quiet dashboard.
          </p>
        </div>

        {/* toggle */}
        <div className="mt-10 flex justify-center">
          <div className="relative inline-flex rounded-full border border-line bg-paper-2/70 p-1 shadow-soft">
            {(["before", "after"] as const).map((k) => {
              const active = (k === "after") === after;
              return (
                <button
                  key={k}
                  onClick={() => setAfter(k === "after")}
                  className="relative z-10 rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors"
                  style={{ color: active ? "#fff" : undefined }}
                >
                  {active && (
                    <motion.span
                      layoutId="ba-pill"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className={`absolute inset-0 -z-10 rounded-full ${
                        k === "after" ? "bg-teal-600" : "bg-rose-500"
                      }`}
                    />
                  )}
                  <span className={active ? "" : "text-ink-soft"}>
                    {k === "after" ? "With PG360" : "Before"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* stage */}
        <div className="relative mx-auto mt-10 min-h-[20rem] max-w-3xl">
          <AnimatePresence mode="wait">
            {!after ? (
              <motion.div
                key="before"
                initial={reduce ? false : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="flex flex-wrap items-center justify-center gap-3 sm:gap-4"
              >
                {BEFORE.map((b, i) => (
                  <motion.div
                    key={b.label}
                    initial={reduce ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, type: "spring", stiffness: 260, damping: 20 }}
                    style={{ rotate: reduce ? "0deg" : b.rot }}
                    className="flex items-center gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/70 px-4 py-3 shadow-soft"
                  >
                    <b.icon className="size-5 shrink-0 text-rose-500" />
                    <span className="text-sm font-medium text-ink">{b.label}</span>
                  </motion.div>
                ))}
                <p className="mt-2 w-full text-center text-sm text-ink-muted">
                  Scattered, stressful, and impossible to scale.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="after"
                initial={reduce ? false : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="mx-auto max-w-xl"
              >
                <div className="media-frame rounded-[1.9rem] p-3">
                  <div className="rounded-[1.5rem] bg-paper/90 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink">Sunrise Stay · June</p>
                      <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-100">
                        All calm
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                      {AFTER.map((a, i) => (
                        <motion.div
                          key={a.label}
                          initial={reduce ? false : { opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.08 + i * 0.06, type: "spring", stiffness: 260, damping: 22 }}
                          className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3"
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                            <a.icon className="size-4.5" />
                          </span>
                          <span className="text-sm font-medium text-ink">{a.label}</span>
                          <CheckCircle2 className="ml-auto size-4 text-teal-500" />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-center text-sm text-ink-muted">
                  One screen. Every tenant served. Real profit, visible.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
