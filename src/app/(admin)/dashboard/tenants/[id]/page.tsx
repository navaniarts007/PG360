import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  IdCard,
  Phone,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PaymentStatusPill,
  TenantStatusPill,
} from "@/components/ui/status";
import { CheckoutSettlementDialog } from "@/components/admin/checkout-settlement-dialog";
import { JoiningFeesCard } from "@/components/admin/joining-fees-card";
import { RentCalendarCard } from "@/components/admin/rent-calendar-card";
import { ElectricityDialog } from "@/components/admin/electricity-dialog";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";
import { AddTenantDialog } from "@/components/admin/add-tenant-dialog";
import { requireRole } from "@/lib/guards";
import {
  getActivePolicy,
  getBedOptions,
  getJoiningFees,
  getPayTenants,
  getTenantDetail,
  listTenantEvents,
} from "@/lib/db";
import { currentMonth, formatDate, initials, inr } from "@/lib/utils";

const EVENT_LABEL: Record<string, string> = {
  joined: "Joined",
  room_changed: "Room change",
  payment: "Payment",
  complaint: "Complaint",
  note: "Note",
  checked_out: "Checked out",
};

export const metadata: Metadata = { title: "Tenant" };

export default async function TenantDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "staff"]);
  const { id } = await params;
  const detail = await getTenantDetail(id);
  if (!detail) notFound();
  const { tenant, room, payments } = detail;

  const outstanding = payments
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + (p.total_amount - p.amount_paid), 0);
  const settlement = tenant.security_deposit - outstanding;

  const [payTenants, beds, joiningFees, policy, events] = await Promise.all([
    getPayTenants(),
    getBedOptions(),
    getJoiningFees(id),
    getActivePolicy(),
    listTenantEvents(id),
  ]);

  return (
    <div className="space-y-7">
      <Link href="/dashboard/tenants" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> All tenants
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {tenant.avatar_url || tenant.aadhaar_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.avatar_url ?? tenant.aadhaar_photo_url ?? ""}
              alt={tenant.name}
              className="size-16 rounded-2xl object-cover shadow-lift ring-1 ring-line"
            />
          ) : (
            <span className="grid size-16 place-items-center rounded-2xl bg-ink text-xl font-semibold text-paper shadow-lift">
              {initials(tenant.name)}
            </span>
          )}
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{tenant.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <TenantStatusPill status={tenant.status} />
              {tenant.reg_no && <Badge tone="neutral">{tenant.reg_no}</Badge>}
              {room && <Badge tone="clay">Room {room.room_number}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/record/${tenant.id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-clay-600"
          >
            <FileText className="size-3.5" /> Print record
          </Link>
          <AddTenantDialog beds={beds} tenant={tenant} />
          {tenant.status === "active" && (
            <>
              <RecordPaymentDialog tenants={payTenants} month={currentMonth()} preselectId={tenant.id} />
              <ElectricityDialog
                tenantId={tenant.id}
                month={currentMonth()}
                includedUnits={policy?.electricity_included_units ?? 0}
                perUnitRate={policy?.electricity_per_unit_rate ?? 0}
              />
              <CheckoutSettlementDialog
                tenant={tenant}
                noticePeriodDays={policy?.notice_period_days ?? 30}
              />
            </>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* details */}
        <Card className="p-5 sm:p-6">
          <h3 className="text-lg text-ink">Details</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Row icon={Phone} label="Phone" value={tenant.phone} />
            <Row icon={IdCard} label="Aadhaar" value={tenant.aadhaar_number ?? "—"} />
            <Row icon={CalendarDays} label="Check-in" value={formatDate(tenant.checkin_date)} />
            <Row icon={CalendarDays} label="Rent due day" value={`Every ${tenant.rent_due_day}th`} />
            {room && <Row icon={Wifi} label="WiFi" value={room.wifi_password} mono />}
          </dl>
        </Card>

        {/* money */}
        <Card className="p-5 sm:p-6">
          <h3 className="text-lg text-ink">Money</h3>
          <div className="mt-4 space-y-3">
            <MoneyRow label="Monthly rent" value={inr(tenant.rent_amount)} />
            <MoneyRow label="Security deposit" value={inr(tenant.security_deposit)} />
            <MoneyRow label="Outstanding" value={inr(outstanding)} tone={outstanding > 0 ? "rose" : "teal"} />
            <div className="mt-2 rounded-xl bg-ink p-4 text-paper">
              <p className="flex items-center gap-1.5 text-xs text-paper/60">
                <ShieldCheck className="size-3.5" /> Indicative refund
              </p>
              <p className="mt-1 font-display text-2xl font-semibold tnum">
                {inr(settlement)}
              </p>
              <p className="text-xs text-paper/50">
                deposit − dues · use “Checkout &amp; settle” for the full calculation
              </p>
            </div>
          </div>
        </Card>

        <JoiningFeesCard fees={joiningFees} tenantId={tenant.id} />

        <RentCalendarCard
          checkinDate={tenant.checkin_date}
          rentDueDay={tenant.rent_due_day}
          payments={payments}
        />


        {/* stay timeline — the police-style activity record */}
        <Card className="lg:col-span-2">
          <div className="border-b border-line p-5 sm:p-6">
            <h3 className="text-lg text-ink">Stay timeline</h3>
            <p className="mt-0.5 text-sm text-ink-muted">Full activity record for verification.</p>
          </div>
          {events.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">No activity recorded yet.</p>
          ) : (
            <ol className="divide-y divide-line">
              {events.map((e) => (
                <li key={e.id} className="flex items-baseline gap-3 px-5 py-3 sm:px-6">
                  <span className="w-28 shrink-0 text-xs text-ink-muted tnum">
                    {formatDate(e.created_at)}
                  </span>
                  <span className="text-sm font-semibold text-ink">{EVENT_LABEL[e.type] ?? e.type}</span>
                  {e.detail && <span className="text-sm text-ink-soft">— {e.detail}</span>}
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* history */}
        <Card className="lg:col-span-1">
          <div className="p-5 pb-3 sm:p-6 sm:pb-3">
            <h3 className="text-lg text-ink">Payment history</h3>
          </div>
          <div className="divide-y divide-line border-t border-line">
            {payments.length === 0 && (
              <p className="px-6 py-6 text-sm text-ink-muted">No payments recorded yet.</p>
            )}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{monthLabel(p.month_for)}</p>
                  <p className="text-xs text-ink-muted tnum">
                    {inr(p.amount_paid)} / {inr(p.total_amount)}
                  </p>
                </div>
                <PaymentStatusPill status={p.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-ink-muted">
        <Icon className="size-4" /> {label}
      </dt>
      <dd className={mono ? "font-mono text-ink" : "font-medium text-ink"}>{value}</dd>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "rose" | "teal";
}) {
  return (
    <div className="flex items-center justify-between border-b border-line pb-3 text-sm last:border-0">
      <span className="text-ink-muted">{label}</span>
      <span
        className={
          tone === "rose"
            ? "font-semibold text-rose-600 tnum"
            : tone === "teal"
              ? "font-semibold text-teal-600 tnum"
              : "font-semibold text-ink tnum"
        }
      >
        {value}
      </span>
    </div>
  );
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y!, (mo ?? 1) - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}
