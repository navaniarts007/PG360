import Link from "next/link";
import { CircleAlert, Receipt } from "lucide-react";
import { myRentReminder } from "@/lib/db";
import { formatDate, inr } from "@/lib/utils";

/** A prominent rent reminder for the tenant — shown only when something is due.
 *  Mirrors the owner's collection reminders, on the resident's side. */
export async function RentReminder() {
  const r = await myRentReminder();
  if (!r) return null;

  const tone = r.overdue
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-gold-200 bg-gold-50 text-gold-700";

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 ${tone}`}>
      <div className="flex items-center gap-3">
        <CircleAlert className="size-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">
            {r.overdue ? "Rent overdue" : "Rent reminder"} — {inr(r.balance)} due
          </p>
          <p className="text-xs opacity-90">
            {r.overdue ? "Was due" : "Due"} {formatDate(r.dueDate)}. Please pay at the earliest.
          </p>
        </div>
      </div>
      <Link
        href="/portal/bill"
        className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-ink-soft"
      >
        <Receipt className="size-4" /> Pay now
      </Link>
    </div>
  );
}
