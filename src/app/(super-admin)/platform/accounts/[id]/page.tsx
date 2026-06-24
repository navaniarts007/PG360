import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BedDouble,
  Building2,
  Mail,
  MapPin,
  Phone,
  Trash2,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PgStatusPill } from "@/components/ui/status";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { EditAccountDialog } from "@/components/platform/edit-account-dialog";
import { PgStatusToggle } from "@/components/platform/pg-status-toggle";
import { requireRole } from "@/lib/guards";
import { deleteAccountAction } from "@/lib/actions/platform";
import { getAccountActivity, getAccountStats, getPgAccount } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import type { TenantEventType } from "@/lib/types";

export const metadata: Metadata = { title: "PG account" };

const EVENT_LABEL: Record<TenantEventType, string> = {
  joined: "Joined",
  room_changed: "Room change",
  payment: "Payment",
  complaint: "Complaint",
  note: "Note",
  checked_out: "Checked out",
};

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  lifetime: "Lifetime",
};

export default async function AccountDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["super_admin"]);
  const { id } = await params;
  const account = await getPgAccount(id);
  if (!account) notFound();

  const [stats, activity] = await Promise.all([
    getAccountStats(id),
    getAccountActivity(id),
  ]);

  return (
    <div className="space-y-7">
      <Link
        href="/platform/accounts"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> All accounts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
            <Building2 className="size-7" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              {account.pg_name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <PgStatusPill status={account.status} />
              <Badge tone={account.edition === "gvm" ? "clay" : "neutral"}>
                {account.edition === "gvm" ? "Stripped edition" : "Full edition"}
              </Badge>
              {!account.portal_enabled && <Badge tone="neutral">No tenant portal</Badge>}
              {account.reg_prefix && <Badge tone="neutral">{account.reg_prefix}-####</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PgStatusToggle id={account.id} status={account.status} />
          <EditAccountDialog account={account} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 sm:p-6">
          <h3 className="text-lg text-ink">Owner &amp; plan</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Row icon={Users} label="Owner" value={account.owner_name} />
            <Row icon={Phone} label="Mobile" value={account.mobile} />
            <Row icon={MapPin} label="Location" value={account.location} />
            <Row icon={Mail} label="Plan" value={`${PLAN_LABEL[account.subscription_plan] ?? account.subscription_plan} · expires ${formatDate(account.subscription_expiry)}`} />
          </dl>
        </Card>

        <Card className="p-5 sm:p-6">
          <h3 className="text-lg text-ink">Occupancy</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat icon={Users} label="Active tenants" value={stats.tenants} />
            <Stat icon={BedDouble} label="Rooms" value={stats.rooms} />
          </div>
          <p className="mt-4 text-xs text-ink-muted">
            Created {formatDate(account.created_at)}
          </p>
        </Card>

        {/* danger zone */}
        <Card className="border-rose-200 p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-lg text-rose-600">
            <Trash2 className="size-4.5" /> Danger zone
          </h3>
          <p className="mt-2 text-sm text-ink-muted">
            Deleting removes the PG and <strong>all</strong> its rooms, tenants and
            payments permanently, plus the owner login. To pause billing instead, use
            suspend.
          </p>
          <div className="mt-4">
            <ConfirmDelete
              action={deleteAccountAction}
              id={account.id}
              title="Delete this account"
              iconOnly={false}
            />
          </div>
        </Card>

        {/* activity */}
        <Card className="lg:col-span-3">
          <div className="border-b border-line p-5 sm:p-6">
            <h3 className="text-lg text-ink">Recent activity</h3>
            <p className="mt-0.5 text-sm text-ink-muted">Latest tenant events in this PG.</p>
          </div>
          {activity.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">No activity recorded yet.</p>
          ) : (
            <ol className="divide-y divide-line">
              {activity.map((e) => (
                <li key={e.id} className="flex items-baseline gap-3 px-5 py-3 sm:px-6">
                  <span className="w-28 shrink-0 text-xs text-ink-muted tnum">
                    {formatDate(e.created_at)}
                  </span>
                  <span className="text-sm font-semibold text-ink">{e.tenant_name}</span>
                  <span className="text-sm text-ink-soft">
                    — {e.detail ?? EVENT_LABEL[e.type]}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-ink-muted">
        <Icon className="size-4" /> {label}
      </dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper-2/40 p-4">
      <Icon className="size-4.5 text-clay-500" />
      <p className="mt-2 font-display text-2xl font-semibold text-ink tnum">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}
