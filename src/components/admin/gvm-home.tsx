import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  BedDouble,
  CreditCard,
  LogOut,
  MessagesSquare,
  ReceiptText,
  UserPlus,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { adminKpis, listRecentEvents, listVacated } from "@/lib/db";
import { currentMonth } from "@/lib/utils";
import type { TenantEventType } from "@/lib/types";

const EVENT_META: Record<TenantEventType, { icon: typeof Users; tone: string; label: string }> = {
  joined: { icon: UserPlus, tone: "bg-teal-50 text-teal-600 ring-teal-100", label: "Joined" },
  room_changed: { icon: BedDouble, tone: "bg-clay-50 text-clay-600 ring-clay-100", label: "Room change" },
  payment: { icon: ReceiptText, tone: "bg-teal-50 text-teal-600 ring-teal-100", label: "Payment" },
  complaint: { icon: MessagesSquare, tone: "bg-rose-50 text-rose-600 ring-rose-100", label: "Complaint" },
  note: { icon: MessagesSquare, tone: "bg-paper-2 text-ink-soft ring-line", label: "Note" },
  checked_out: { icon: LogOut, tone: "bg-rose-50 text-rose-600 ring-rose-100", label: "Checked out" },
};

function timeAgo(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export async function GvmHome({ ownerName }: { ownerName: string }) {
  const [kpis, vacated, events] = await Promise.all([
    adminKpis(currentMonth()),
    listVacated(),
    listRecentEvents(10),
  ]);

  const cards = [
    { href: "/dashboard/tenants", label: "Tenants", value: String(kpis.totalTenants), sub: "active now", icon: Users, tone: "clay" },
    { href: "/dashboard/tenants", label: "Add tenant", value: "New", sub: "register a guest", icon: UserPlus, tone: "teal" },
    { href: "/dashboard/payments", label: "Payments", value: "Record", sub: "rent this month", icon: CreditCard, tone: "clay" },
    { href: "/dashboard/vacated", label: "Vacated", value: String(vacated.length), sub: "past records", icon: Archive, tone: "teal" },
  ] as const;

  const tone = (t: string) =>
    t === "teal" ? "bg-teal-50 text-teal-600 ring-teal-100" : "bg-clay-50 text-clay-600 ring-clay-100";

  return (
    <div className="space-y-7">
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-clay-500">
          {ownerName}
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-ink">
          Quick actions
        </h1>
      </div>

      {/* 2x2 big quick-action cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="editorial-card hover-card group flex flex-col justify-between rounded-[1.5rem] p-5 sm:p-6"
          >
            <div className="flex items-start justify-between">
              <span className={`grid size-12 place-items-center rounded-2xl ring-1 ring-inset ${tone(c.tone)}`}>
                <c.icon className="size-6" />
              </span>
              <ArrowUpRight className="size-4 text-ink-muted transition-colors group-hover:text-clay-600" />
            </div>
            <div className="mt-5">
              <p className="font-display text-2xl font-semibold text-ink tnum">{c.value}</p>
              <p className="text-sm font-semibold text-ink">{c.label}</p>
              <p className="text-xs text-ink-muted">{c.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* recent activity */}
      <Card>
        <div className="border-b border-line p-5 sm:p-6">
          <h3 className="text-lg text-ink">Recent activity</h3>
        </div>
        {events.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">No activity yet — add your first tenant.</p>
        ) : (
          <ul className="divide-y divide-line">
            {events.map((e) => {
              const m = EVENT_META[e.type];
              return (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-inset ${m.tone}`}>
                    <m.icon className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{e.tenant_name}</p>
                    <p className="truncate text-xs text-ink-muted">{e.detail ?? m.label}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-muted">{timeAgo(e.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
