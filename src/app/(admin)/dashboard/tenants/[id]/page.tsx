import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  ExternalLink,
  FileText,
  IdCard,
  MapPin,
  Phone,
  ScrollText,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PaymentStatusPill,
  TenantStatusPill,
} from "@/components/ui/status";
import { ChangeBedDialog } from "@/components/admin/change-bed-dialog";
import { CheckoutSettlementDialog } from "@/components/admin/checkout-settlement-dialog";
import { JoiningFeesCard } from "@/components/admin/joining-fees-card";
import { RentCalendarCard } from "@/components/admin/rent-calendar-card";
import { SignedAgreement } from "@/components/admin/signed-agreement";
import { DocumentsManager } from "@/components/admin/documents-manager";
import { ElectricityDialog } from "@/components/admin/electricity-dialog";
import { RecordPaymentDialog } from "@/components/admin/record-payment-dialog";
import { AddTenantDialog } from "@/components/admin/add-tenant-dialog";
import { requireRole } from "@/lib/guards";
import {
  getBedOptions,
  getJoiningFees,
  getKycSignedUrl,
  getKycSignedUrls,
  getPayTenants,
  getPgAccount,
  getPgPolicy,
  getTenantAgreement,
  getTenantDetail,
  listTenantDocumentsSigned,
  listTenantEvents,
} from "@/lib/db";
import { currentMonth, formatDate, initials, inr } from "@/lib/utils";
import type { Payment } from "@/lib/types";
import { ordinal } from "@/lib/rent";

const EVENT_LABEL: Record<string, string> = {
  joined: "Joined",
  room_changed: "Room change",
  payment: "Payment",
  complaint: "Complaint",
  note: "Note",
  checked_out: "Checked out",
};

function paymentTypes(p: Payment) {
  const labels = [
    p.base_rent > 0 ? "Base rent" : null,
    p.electricity_charge > 0 ? "Electricity" : null,
    p.food_charge > 0 ? "Food" : null,
    p.other_charges > 0 ? "Other" : null,
    p.security_deposit > 0 ? "Security deposit" : null,
    p.joining_fee > 0 ? "Joining / admission" : null,
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(" · ") : "Not recorded";
}

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

  const [payTenants, beds, joiningFees, policy, events, aadhaarUrls, documents, pgAccount, agreement] = await Promise.all([
    getPayTenants(),
    getBedOptions(),
    getJoiningFees(id),
    getPgPolicy(tenant.pg_id),
    listTenantEvents(id),
    getKycSignedUrls(tenant.aadhaar_photo_url),
    listTenantDocumentsSigned(id),
    getPgAccount(tenant.pg_id),
    getTenantAgreement(id),
  ]);

  const [ownerSig, tenantSig] = await Promise.all([
    getKycSignedUrl(pgAccount?.owner_signature_url ?? null),
    getKycSignedUrl(agreement?.signature_url ?? null),
  ]);

  const rulesDocUrl = pgAccount?.rules_doc_url ?? ((pgAccount?.settings as Record<string, unknown>)?.rules_doc_url as string | null) ?? null;
  const aadhaarUrl = aadhaarUrls[0] ?? null;
  const joiningTotal = joiningFees.reduce((s, f) => s + f.amount, 0);
  const onboardingTotal = tenant.rent_amount + tenant.security_deposit + joiningTotal;

  return (
    <div className="space-y-7">
      <Link href="/dashboard/tenants" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> All tenants
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {tenant.avatar_url || aadhaarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.avatar_url ?? aadhaarUrl ?? ""}
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
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Link
            href={`/record/${tenant.id}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-clay-600"
          >
            <FileText className="size-3.5" /> Print record
          </Link>
          <ChangeBedDialog tenant={tenant} beds={beds} />
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
            {tenant.parent_phone && <Row icon={Phone} label="Parent's phone" value={tenant.parent_phone} />}
            {tenant.guardian && <Row icon={Phone} label="Other (guardian/friend)" value={tenant.guardian} />}
            {tenant.vehicle_number && <Row icon={IdCard} label="Vehicle number" value={tenant.vehicle_number} />}
            {tenant.address && <Row icon={MapPin} label="Address" value={tenant.address} />}
            {tenant.occupation && (
              <Row
                icon={Briefcase}
                label={tenant.occupation === "student" ? "Student" : tenant.occupation === "working" ? "Working" : "Occupation"}
                value={tenant.organization || (tenant.occupation === "student" ? "Student" : tenant.occupation === "working" ? "Working professional" : "Other")}
              />
            )}
            <Row icon={IdCard} label="Aadhaar" value={tenant.aadhaar_number ?? "—"} />
            <Row icon={CalendarDays} label="Check-in" value={formatDate(tenant.checkin_date)} />
            <Row icon={CalendarDays} label="Rent due day" value={`${ordinal(tenant.rent_due_day)} of each month`} />
            {room && <Row icon={Wifi} label="WiFi" value={room.wifi_password} mono />}
          </dl>
        </Card>

        {/* money */}
        <Card className="p-5 sm:p-6">
          <h3 className="text-lg text-ink">Money</h3>
          <div className="mt-4 space-y-3">
            <MoneyRow label="Monthly rent" value={inr(tenant.rent_amount)} />
            <MoneyRow label="Security deposit" value={inr(tenant.security_deposit)} />
            <MoneyRow label="Joining / admission fee" value={inr(joiningTotal)} />
            <MoneyRow label="Total onboarding" value={inr(onboardingTotal)} strong />
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
          monthlyRent={tenant.rent_amount}
          securityDeposit={tenant.security_deposit}
          payments={payments}
          stayType={tenant.stay_type}
          dailyRate={tenant.daily_rate}
          stayDays={tenant.stay_days}
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
                  <p className="text-xs text-ink-muted tnum">{inr(p.amount_paid)} / {inr(p.total_amount)}</p>
                  <p className="text-xs text-ink">Type: {paymentTypes(p)}</p>
                </div>
                <PaymentStatusPill status={p.status} />
              </div>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-3">
          <TenantRulesCard
            rulesDocUrl={rulesDocUrl}
            ownerSig={ownerSig}
            tenantSig={tenantSig}
            tenantName={tenant.name}
            ownerName={pgAccount?.owner_name ?? "Owner"}
            pgName={pgAccount?.pg_name ?? ""}
            pgAddress={pgAccount?.property_address ?? null}
          />
        </div>

        <div className="lg:col-span-3">
          <DocumentsManager tenantId={tenant.id} docs={documents} aadhaarUrl={aadhaarUrl} aadhaarUrls={aadhaarUrls} />
        </div>

        <div className="lg:col-span-3">
          <SignedAgreement pgId={tenant.pg_id} tenantId={tenant.id} tenantName={tenant.name} />
        </div>
      </div>
    </div>
  );
}

function TenantRulesCard({
  rulesDocUrl,
  ownerSig,
  tenantSig,
  tenantName,
  ownerName,
  pgName,
  pgAddress,
}: {
  rulesDocUrl: string | null;
  ownerSig: string | null;
  tenantSig: string | null;
  tenantName: string;
  ownerName: string;
  pgName: string;
  pgAddress: string | null;
}) {
  const isImage = rulesDocUrl
    ? /\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i.test(rulesDocUrl) || rulesDocUrl.includes("/image/upload/")
    : false;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
            <ScrollText className="size-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-ink">Rules &amp; Regulations</h3>
            <p className="text-xs text-ink-muted">Official house rules document for this resident</p>
          </div>
        </div>
        {rulesDocUrl && (
          <a
            href={rulesDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-clay-600 transition-colors hover:bg-paper-2"
          >
            <ExternalLink className="size-3.5" /> View / Download
          </a>
        )}
      </div>

      {rulesDocUrl ? (
        <>
          {/* A4 document area */}
          <div className="border-t border-line bg-[#f5f5f0] px-4 py-5 sm:px-8">
            {/* A4 paper: 210mm × 297mm ≈ aspect ratio 1:√2 ≈ 1:1.414 */}
            <div
              className="mx-auto w-full max-w-[794px] overflow-hidden rounded-lg bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
              style={{ aspectRatio: "1 / 1.414" }}
            >
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={rulesDocUrl}
                  alt="Rules & Regulations"
                  className="h-full w-full object-contain"
                />
              ) : (
                <iframe
                  src={rulesDocUrl}
                  title="Rules & Regulations"
                  className="h-full w-full border-0"
                />
              )}
            </div>
          </div>

          {/* Signatures row */}
          <div className="border-t border-line px-5 py-5 sm:px-8">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Signatures</p>
            <div className="grid grid-cols-2 gap-6">
              {/* Owner */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">Owner / Manager</p>
                <div className="flex h-24 items-center justify-center rounded-xl border border-line bg-paper-2/40">
                  {ownerSig ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ownerSig} alt="Owner signature" className="max-h-20 object-contain" />
                  ) : (
                    <span className="text-xs text-ink-muted">No signature yet</span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">{ownerName}{pgName ? ` · ${pgName}` : ""}</p>
                {pgAddress && <p className="text-xs text-ink-muted">{pgAddress}</p>}
              </div>

              {/* Tenant */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">Resident</p>
                <div className="flex h-24 items-center justify-center rounded-xl border border-line bg-paper-2/40">
                  {tenantSig ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tenantSig} alt="Tenant signature" className="max-h-20 object-contain" />
                  ) : (
                    <span className="text-xs text-ink-muted">No signature yet</span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">{tenantName}</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="border-t border-line px-5 py-8 text-center">
          <ScrollText className="mx-auto size-9 text-ink-muted" />
          <p className="mt-2 text-sm text-ink-muted">No Rules &amp; Regulations document uploaded yet.</p>
          <Link
            href="/dashboard/settings"
            className="mt-2 inline-block text-xs font-semibold text-clay-600 hover:underline"
          >
            Upload in Settings →
          </Link>
        </div>
      )}
    </Card>
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
  strong,
}: {
  label: string;
  value: string;
  tone?: "rose" | "teal";
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex items-center justify-between border-b border-line pb-3 text-sm last:border-0 -mx-1 rounded-lg bg-paper-2/60 px-2 py-1"
          : "flex items-center justify-between border-b border-line pb-3 text-sm last:border-0"
      }
    >
      <span className={strong ? "font-semibold text-ink" : "text-ink-muted"}>{label}</span>
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
