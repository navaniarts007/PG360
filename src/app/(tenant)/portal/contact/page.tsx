import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Building2, MapPin, MessageCircle, Phone, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/guards";
import { getMyPg } from "@/lib/db";

export const metadata: Metadata = { title: "Contact" };

export default async function Contact() {
  await requireRole(["tenant"]);
  const pg = await getMyPg();
  if (!pg) notFound();

  const tel = pg?.mobile ?? "";
  const wa = tel.replace(/[^0-9]/g, "");

  return (
    <div className="space-y-7">
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-clay-500">
          Help
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-[2.1rem]">
          Contact
        </h1>
        <p className="mt-1.5 text-ink-soft">Reach your PG owner directly — we&apos;re here to help.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <a
          href={`tel:${tel}`}
          className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift"
        >
          <span className="grid size-12 place-items-center rounded-xl bg-ink text-paper">
            <Phone className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-ink">Call admin</p>
            <p className="text-sm text-ink-muted tnum">{tel}</p>
          </div>
        </a>

        <a
          href={`https://wa.me/${wa}`}
          className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift"
        >
          <span className="grid size-12 place-items-center rounded-xl bg-teal-500 text-white">
            <MessageCircle className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-ink">WhatsApp admin</p>
            <p className="text-sm text-ink-muted">Chat instantly</p>
          </div>
        </a>
      </div>

      <Card className="p-5 sm:p-6">
        <h3 className="text-lg text-ink">Your PG</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Building2 className="size-4 text-ink-muted" />
            <span className="font-medium text-ink">{pg?.pg_name ?? "—"}</span>
          </div>
          <div className="flex items-center gap-3">
            <User className="size-4 text-ink-muted" />
            <span className="text-ink-soft">Owner · {pg?.owner_name ?? "—"}</span>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="size-4 text-ink-muted" />
            <span className="text-ink-soft">{pg?.location ?? "—"}</span>
          </div>
        </dl>
      </Card>
    </div>
  );
}
