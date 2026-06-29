import type { Metadata } from "next";
import { Database, Cloud, Triangle, ExternalLink, HardDrive, Image as ImageIcon, Activity, Gauge } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/guards";
import { supabaseUsage, supabaseEgress, cloudinaryUsage, vercelInfo } from "@/lib/usage";

export const metadata: Metadata = { title: "Infrastructure usage" };

const SUPA_PROJECT = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1] ?? "";

function gb(bytes: number) {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}
const n = (x: number) => x.toLocaleString("en-IN");

export default async function UsagePage() {
  await requireRole(["super_admin"]);
  const [supa, egress, cld, vercel] = await Promise.all([
    supabaseUsage(),
    supabaseEgress(),
    cloudinaryUsage(),
    vercelInfo(),
  ]);
  const egressPct =
    egress.egressBytes != null
      ? Math.min(100, Math.round((egress.egressBytes / (egress.quotaGb * 1024 ** 3)) * 100))
      : null;
  const billingHref = SUPA_PROJECT
    ? `https://supabase.com/dashboard/project/${SUPA_PROJECT}/settings/billing`
    : "https://supabase.com/dashboard";

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Super admin"
        title="Infrastructure usage"
        subtitle="Live usage across the services that power PG360."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* SUPABASE */}
        <Card className="p-5 sm:p-6">
          <Head icon={Database} tone="teal" title="Supabase" href={SUPA_PROJECT ? `https://supabase.com/dashboard/project/${SUPA_PROJECT}` : "https://supabase.com/dashboard"} />
          {supa ? (
            <dl className="mt-4 space-y-3">
              <Stat icon={Database} label="Database size" value={gb(supa.db_bytes)} />
              <Stat icon={HardDrive} label="Storage (KYC etc.)" value={`${gb(supa.storage_bytes)} · ${n(supa.storage_objects)} files`} />
              <Stat icon={Activity} label="Auth users" value={n(supa.auth_users)} />
              <Stat icon={Activity} label="Records" value={`${n(supa.tenant_count)} tenants · ${n(supa.payment_count)} payments`} />
            </dl>
          ) : (
            <Unavailable note="Run migration 0025, then reload." />
          )}

          {/* bandwidth / egress */}
          <div className="mt-4 rounded-xl border border-line bg-paper-2/40 p-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-ink-muted"><Gauge className="size-4" /> Egress this cycle</span>
              <a href={billingHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-clay-600 hover:text-clay-700">
                Billing <ExternalLink className="size-3" />
              </a>
            </div>
            {egress.egressBytes != null ? (
              <>
                <p className="mt-1 font-semibold text-ink tnum">{gb(egress.egressBytes)} <span className="text-xs font-normal text-ink-muted">of {egress.quotaGb} GB</span></p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <div className={`h-full rounded-full ${(egressPct ?? 0) > 80 ? "bg-rose-500" : "bg-teal-500"}`} style={{ width: `${egressPct ?? 0}%` }} />
                </div>
              </>
            ) : (
              <p className="mt-1 text-xs text-ink-muted">
                {egress.configured
                  ? `Not exposed by the API on this plan — open Billing for the exact figure (quota ${egress.quotaGb} GB).`
                  : `Add SUPABASE_ACCESS_TOKEN to show egress here. Quota ${egress.quotaGb} GB/mo — see Billing.`}
              </p>
            )}
          </div>

          <p className="mt-4 text-xs text-ink-muted">Region: Mumbai (ap-south-1) · India</p>
        </Card>

        {/* CLOUDINARY */}
        <Card className="p-5 sm:p-6">
          <Head icon={Cloud} tone="clay" title="Cloudinary" href="https://console.cloudinary.com/" />
          {cld ? (
            <dl className="mt-4 space-y-3">
              <Stat icon={HardDrive} label="Storage used" value={gb(cld.storageBytes)} />
              <Stat icon={ImageIcon} label="Assets" value={n(cld.objects)} />
              <Stat icon={Activity} label="Bandwidth (cycle)" value={gb(cld.bandwidthBytes)} />
              <Stat icon={Activity} label="Transformations" value={n(cld.transformations)} />
              {cld.creditsUsed != null && (
                <Stat icon={Activity} label="Credits" value={`${cld.creditsUsed.toFixed(2)}${cld.creditsLimit ? ` / ${cld.creditsLimit}` : ""}`} />
              )}
            </dl>
          ) : (
            <Unavailable note="Cloudinary API not reachable / not configured." />
          )}
          <p className="mt-4 text-xs text-ink-muted capitalize">Plan: {cld?.plan ?? "—"}</p>
        </Card>

        {/* VERCEL */}
        <Card className="p-5 sm:p-6">
          <Head icon={Triangle} tone="ink" title="Vercel" href="https://vercel.com/dashboard" />
          {vercel.configured ? (
            vercel.deployments.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {vercel.deployments.map((d, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.state === "READY" ? "bg-teal-50 text-teal-700 ring-1 ring-teal-100" : "bg-gold-50 text-gold-700 ring-1 ring-gold-100"}`}>
                      {d.state}
                    </span>
                    <span className="truncate text-ink-soft">{d.url}</span>
                    <span className="shrink-0 text-xs text-ink-muted">{new Date(d.created).toLocaleDateString("en-IN")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Unavailable note="Connected, but no deployments returned." />
            )
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-line bg-paper-2/40 p-4 text-sm text-ink-soft">
              <p className="font-semibold text-ink">Not connected</p>
              <p className="mt-1 text-xs text-ink-muted">
                Add <code className="rounded bg-paper-2 px-1">VERCEL_TOKEN</code> (and optionally
                <code className="ml-1 rounded bg-paper-2 px-1">VERCEL_PROJECT_ID</code>) to env to show recent
                deployments here. Bandwidth/build usage stays on the Vercel dashboard.
              </p>
            </div>
          )}
        </Card>
      </div>

      <p className="text-xs text-ink-muted">
        Figures are live where the provider exposes them. Open each provider&apos;s dashboard for full billing &amp; quotas.
      </p>
    </div>
  );
}

function Head({ icon: Icon, tone, title, href }: { icon: React.ElementType; tone: "teal" | "clay" | "ink"; title: string; href: string }) {
  const t = { teal: "bg-teal-50 text-teal-600 ring-teal-100", clay: "bg-clay-50 text-clay-600 ring-clay-100", ink: "bg-ink text-paper ring-ink" }[tone];
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className={`grid size-9 place-items-center rounded-xl ring-1 ring-inset ${t}`}><Icon className="size-4.5" /></span>
        <h3 className="text-lg text-ink">{title}</h3>
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-clay-600 hover:text-clay-700">
        Dashboard <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="flex items-center gap-2 text-ink-muted"><Icon className="size-4" /> {label}</dt>
      <dd className="text-right font-semibold text-ink tnum">{value}</dd>
    </div>
  );
}

function Unavailable({ note }: { note: string }) {
  return <p className="mt-4 rounded-xl border border-dashed border-line bg-paper-2/40 p-4 text-sm text-ink-muted">{note}</p>;
}
