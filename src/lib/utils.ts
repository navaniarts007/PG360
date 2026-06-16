import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, de-duplicating conflicting Tailwind classes. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an integer rupee amount as ₹1,23,456 (Indian grouping). */
export function inr(amount: number, opts: { decimals?: boolean } = {}) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: opts.decimals ? 2 : 0,
    minimumFractionDigits: opts.decimals ? 2 : 0,
  }).format(amount);
}

/** Compact rupee for KPI cards: ₹1.2L, ₹85k. */
export function inrCompact(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)}Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(2)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}k`;
  return `₹${amount}`;
}

/** Initials from a full name, e.g. "Ravi Kumar" -> "RK". */
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Current month as 'YYYY-MM' (Asia/Kolkata-ish; server clock). */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MEALS = ["breakfast", "lunch", "dinner"] as const;

export interface WeekDay {
  iso: string; // local YYYY-MM-DD
  dayIndex: number; // 0=Mon .. 6=Sun
  label: string; // "Mon"
  dayNum: number; // date of month
  isToday: boolean;
}

/** The 7 dates of the current week (Mon..Sun), in local time. */
export function weekDates(base = new Date()): WeekDay[] {
  const todayIso = localIso(base);
  const dow = (base.getDay() + 6) % 7; // 0=Mon
  const monday = new Date(base);
  monday.setDate(base.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    const iso = localIso(dt);
    return {
      iso,
      dayIndex: i,
      label: DAY_NAMES[i]!,
      dayNum: dt.getDate(),
      isToday: iso === todayIso,
    };
  });
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function formatDate(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
