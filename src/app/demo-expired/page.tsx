import type { Metadata } from "next";
import { Clock, Phone, MessageCircle } from "lucide-react";
import { requireRole } from "@/lib/guards";
import { Logo } from "@/components/brand/logo";
import { LogoutButton } from "@/components/app/logout-button";
import { CONTACT } from "@/lib/site";

export const metadata: Metadata = { title: "Trial ended" };

export default async function DemoExpiredPage() {
  await requireRole(["admin", "staff"]);

  return (
    <div className="grid min-h-screen place-items-center bg-paper-2 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-7 shadow-soft sm:p-9">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gold-50 text-gold-600 ring-1 ring-gold-100">
            <Clock className="size-7" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold text-ink">Your trial has ended</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Thanks for trying PG360! Your demo period is over. Your data is safe — get in
            touch to activate your account and pick up right where you left off.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <a
              href={CONTACT.whatsapp}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-600"
            >
              <MessageCircle className="size-4" /> WhatsApp us
            </a>
            <a
              href={CONTACT.tel}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink-soft transition-colors hover:text-clay-600"
            >
              <Phone className="size-4" /> {CONTACT.phone}
            </a>
          </div>

          <div className="mt-5">
            <LogoutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
