/* =========================================================================
   PG360 — Bangalore money model (Phase A2). Pure, dependency-free helpers used
   by both server (bill derivation, checkout) and client (previews). All money
   is in whole rupees (int), matching the schema.
   ========================================================================= */

/** Number of days in a "YYYY-MM" month. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y ?? 1970, m ?? 1, 0).getDate();
}

/** Is `dateISO` (YYYY-MM-DD) within the given "YYYY-MM" month? */
export function isSameMonth(dateISO: string, month: string): boolean {
  return dateISO.slice(0, 7) === month;
}

export interface ProRata {
  isProRata: boolean;
  days: number;
  amount: number;
}

/**
 * First-month pro-rata. If the tenant checked in during `month`, they pay only
 * for the days from check-in to month end; otherwise the full bed price.
 */
export function proRataFirstMonth(
  pricePerMonth: number,
  checkinISO: string,
  month: string,
): ProRata {
  if (!isSameMonth(checkinISO, month)) {
    return { isProRata: false, days: daysInMonth(month), amount: pricePerMonth };
  }
  const total = daysInMonth(month);
  const day = Number(checkinISO.slice(8, 10)) || 1;
  const days = total - day + 1;
  const amount = Math.round((pricePerMonth / total) * days);
  return { isProRata: true, days, amount };
}

/** Add `days` to a YYYY-MM-DD date, returning YYYY-MM-DD. Used to derive a
 *  day-wise stay's expected checkout from check-in + number of days. */
export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface BillInput {
  pricePerMonth: number;
  checkinISO: string;
  month: string;
  foodOptOut: boolean;
  foodOptOutDeduction: number;
  electricityCharge?: number;
  otherCharges?: number;
}

export interface BillBreakdown {
  baseRent: number;
  isProRata: boolean;
  proRataDays: number;
  foodDeduction: number;
  electricity: number;
  other: number;
  total: number;
}

/** Compute a monthly invoice the Bangalore way: pro-rata base, food included by
 *  default (deduct on opt-out), plus electricity / other extras. */
export function computeBill(input: BillInput): BillBreakdown {
  const pr = proRataFirstMonth(input.pricePerMonth, input.checkinISO, input.month);
  const foodDeduction = input.foodOptOut ? input.foodOptOutDeduction : 0;
  const electricity = input.electricityCharge ?? 0;
  const other = input.otherCharges ?? 0;
  const total = Math.max(0, pr.amount - foodDeduction + electricity + other);
  return {
    baseRent: pr.amount,
    isProRata: pr.isProRata,
    proRataDays: pr.days,
    foodDeduction,
    electricity,
    other,
    total,
  };
}

/** Whole days between two YYYY-MM-DD dates (b - a), never negative. */
export function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO + "T00:00:00").getTime();
  const b = new Date(bISO + "T00:00:00").getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export interface SettlementInput {
  pricePerMonth: number;
  checkoutISO: string;
  lastPaidUntilISO: string | null; // end of last fully-paid period
  noticeGivenISO: string | null;
  noticePeriodDays: number;
  lockInEndISO: string | null;
  depositAmount: number;
  damages?: number;
  advanceAmount?: number; // tenant-paid advance to refund / adjust at checkout
}

export interface SettlementBreakdown {
  dailyRate: number;
  proRataDaysOwed: number;
  proRataAmount: number;
  noticeShortfallDays: number;
  noticePenalty: number;
  lockInForfeiture: number;
  damages: number;
  depositAmount: number;
  advanceAmount: number;
  totalDeductions: number;
  totalCredits: number; // deposit + advance
  refundableAmount: number; // owner returns this (dues fully covered)
  amountDue: number; // tenant still pays this (dues exceed credits)
}

/** Final settlement when a tenant leaves: dues + short-notice penalty + lock-in
 *  forfeiture + damages, netted against the refundable deposit. */
export function computeSettlement(input: SettlementInput): SettlementBreakdown {
  const dailyRate = Math.round(input.pricePerMonth / 30);

  const proRataDaysOwed = input.lastPaidUntilISO
    ? daysBetween(input.lastPaidUntilISO, input.checkoutISO)
    : 0;
  const proRataAmount = proRataDaysOwed * dailyRate;

  const noticeGivenDays = input.noticeGivenISO
    ? daysBetween(input.noticeGivenISO, input.checkoutISO)
    : 0;
  const noticeShortfallDays = Math.max(0, input.noticePeriodDays - noticeGivenDays);
  const noticePenalty = noticeShortfallDays * dailyRate;

  const lockInForfeiture =
    input.lockInEndISO && input.checkoutISO < input.lockInEndISO
      ? input.pricePerMonth
      : 0;

  const damages = input.damages ?? 0;
  const advanceAmount = input.advanceAmount ?? 0;
  const totalDeductions = proRataAmount + noticePenalty + lockInForfeiture + damages;
  // deposit + advance are both credits to the tenant. When dues are covered the
  // surplus (incl. the advance) is refunded; when dues exceed the credits the
  // advance is adjusted against them and the tenant pays the remainder.
  const totalCredits = input.depositAmount + advanceAmount;
  const refundableAmount = Math.max(0, totalCredits - totalDeductions);
  const amountDue = Math.max(0, totalDeductions - totalCredits);

  return {
    dailyRate,
    proRataDaysOwed,
    proRataAmount,
    noticeShortfallDays,
    noticePenalty,
    lockInForfeiture,
    damages,
    depositAmount: input.depositAmount,
    advanceAmount,
    totalDeductions,
    totalCredits,
    refundableAmount,
    amountDue,
  };
}

/** Indian-English rupee amount in words, e.g. 12500 -> "Twelve Thousand Five
 *  Hundred Rupees Only" — for HRA receipts. */
export function rupeesInWords(n: number): string {
  n = Math.round(Math.abs(n));
  if (n === 0) return "Zero Rupees Only";
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const two = (x: number): string => {
    if (x < 20) return ones[x]!;
    return (tens[Math.floor(x / 10)]! + (x % 10 ? " " + ones[x % 10]! : "")).trim();
  };
  const three = (x: number): string => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return ((h ? ones[h]! + " Hundred" + (r ? " " : "") : "") + (r ? two(r) : "")).trim();
  };

  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(three(crore) + " Crore");
  if (lakh) parts.push(three(lakh) + " Lakh");
  if (thousand) parts.push(three(thousand) + " Thousand");
  if (n) parts.push(three(n));
  return parts.join(" ") + " Rupees Only";
}
