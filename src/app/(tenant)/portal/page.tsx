import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  BedDouble,
  CheckCircle2,
  Layers,
  MessageCircle,
  Phone,
  Receipt,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { WifiCard } from "@/components/marketing/wifi-card";
import { requireRole } from "@/lib/guards";
import { getMyPayments, getMyPg, getMyTenant, getRoommateNames } from "@/lib/db";
import { currentMonth, initials, inr } from "@/lib/utils";

export const metadata: Metadata = { title: "My Room" };

const TYPE: Record<string, string> = { single: "Single", double: "Double", triple: "Triple" };

export default async function MyRoom() {
  await requireRole(["tenant"]);
  const mine = await getMyTenant();
  if (!mine) notFound();
  const { tenant, room } = mine;

  const [pg, payments, roommates] = await Promise.all([
    getMyPg(),
    getMyPayments(),
    room ? getRoommateNames(room.id, tenant.id) : Promise.resolve<string[]>([]),
  ]);
  const thisMonth = payments.find((p) => p.month_for === currentMonth());

  return (
    <div className="space-y-7">
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-clay-500">
          {pg?.pg_name ?? "My PG"}
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-[2.1rem]">
          Hi {tenant.name.split(" ")[0]} 👋
        </h1>
        <p className="mt-1.5 text-ink-soft">Everything about your stay, in one place.</p>
      </div>

      {!room ? (
        <EmptyState icon={BedDouble} title="No room assigned yet" body="Your PG owner will assign your room shortly." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <WifiCard
              password={room.wifi_password}
              network={room.wifi_ssid ?? `${pg?.pg_name ?? "PG"} WiFi`}
              room={`Room ${room.room_number}`}
            />
          </div>

          <Card className="flex flex-col justify-between p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">This month</p>
              {thisMonth ? (
                <Badge tone={thisMonth.status === "paid" ? "teal" : thisMonth.status === "partial" ? "gold" : "rose"} dot>
                  {thisMonth.status === "paid" ? "Paid" : thisMonth.status === "partial" ? "Partial" : "Due"}
                </Badge>
              ) : (
                <Badge tone="neutral">Not billed</Badge>
              )}
            </div>
            <p className="mt-3 font-display text-3xl font-semibold text-ink tnum">
              {inr(thisMonth?.total_amount ?? tenant.rent_amount)}
            </p>
            <Link href="/portal/bill" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-clay-600 hover:text-clay-700">
              <Receipt className="size-4" /> View full bill
            </Link>
          </Card>

          <Card className="p-5 sm:p-6 lg:col-span-2">
            <h3 className="text-lg text-ink">Your room</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Detail icon={BedDouble} label="Room" value={`Room ${room.room_number}`} />
              <Detail icon={Layers} label="Floor & type" value={`Floor ${room.floor} · ${TYPE[room.type]}`} />
            </div>
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Amenities</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {room.amenities.map((a) => (
                  <Badge key={a} tone="neutral">
                    <CheckCircle2 className="size-3 text-teal-500" /> {a}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-ink-muted" />
              <h3 className="text-lg text-ink">Roommates</h3>
            </div>
            {roommates.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">You have the room to yourself.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {roommates.map((name, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-clay-50 text-xs font-semibold text-clay-600">
                      {initials(name)}
                    </span>
                    <span className="text-sm font-medium text-ink">{name}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center lg:col-span-3">
            <div>
              <h3 className="text-lg text-ink">Need something?</h3>
              <p className="text-sm text-ink-muted">Reach {pg?.owner_name ?? "your PG owner"} directly.</p>
            </div>
            <div className="flex gap-2">
              <a href={`tel:${pg?.mobile ?? ""}`} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-ink-soft">
                <Phone className="size-4" /> Call admin
              </a>
              <a href={`https://wa.me/${(pg?.mobile ?? "").replace(/[^0-9]/g, "")}`} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-600">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-paper-2/40 p-3.5">
      <span className="grid size-9 place-items-center rounded-lg bg-surface text-clay-600 ring-1 ring-line">
        <Icon className="size-4.5" />
      </span>
      <div>
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="text-sm font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}
