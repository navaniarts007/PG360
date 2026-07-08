import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/guards";
import { getTenantDetail, getPgAccount, listTenantEvents, getKycSignedUrl, listTenantDocumentsSigned } from "@/lib/db";
import { DOC_LABELS } from "@/lib/types";
import { formatDate, inr } from "@/lib/utils";
import { PrintButton } from "@/components/tenant/print-button";
import { SignedAgreement } from "@/components/admin/signed-agreement";
import type { TenantEventType } from "@/lib/types";

export const metadata: Metadata = { title: "Tenant Record" };

const EVENT_LABEL: Record<TenantEventType, string> = {
  joined: "Joined",
  room_changed: "Room change",
  payment: "Payment",
  complaint: "Complaint",
  note: "Note",
  checked_out: "Checked out",
};

export default async function RecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "staff"]);
  const { id } = await params;
  const detail = await getTenantDetail(id);
  if (!detail) notFound();
  const { tenant, room } = detail;
  const [pg, events, aadhaarUrl, documents] = await Promise.all([
    getPgAccount(tenant.pg_id),
    listTenantEvents(id),
    getKycSignedUrl(tenant.aadhaar_photo_url),
    listTenantDocumentsSigned(id),
  ]);

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 font-medium text-ink">{value || "—"}</p>
    </div>
  );

  // Only prints when there's a value — empty/unknown fields are omitted entirely.
  const Detail = ({ label, value }: { label: string; value?: string | number | null }) =>
    value === null || value === undefined || value === "" ? null : (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="mt-1 font-medium text-ink">{value}</p>
      </div>
    );

  const occupationText =
    tenant.occupation === "student"
      ? "Student"
      : tenant.occupation === "working"
        ? "Working professional"
        : tenant.occupation
          ? tenant.occupation[0]!.toUpperCase() + tenant.occupation.slice(1)
          : "";

  const hasDetails = !!(
    tenant.parent_phone ||
    tenant.guardian ||
    tenant.vehicle_number ||
    tenant.address ||
    occupationText ||
    tenant.organization ||
    tenant.email ||
    tenant.rent_amount ||
    tenant.security_deposit
  );

  return (
    <main className="min-h-screen bg-paper-2 px-4 py-8 print:bg-white print:p-0">
      <style>{`@media print {
        .no-print { display:none !important; }
        @page { margin: 14mm; }
        img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        section { break-inside: avoid; }
      }`}</style>
      <div className="mx-auto max-w-2xl">
        <div className="no-print mb-5 flex items-center justify-between">
          <Link href="/dashboard/tenants" className="text-sm font-semibold text-clay-600 hover:text-clay-700">
            ← Back
          </Link>
          <PrintButton />
        </div>

        <article className="rounded-2xl border border-line bg-white p-8 shadow-soft print:border-0 print:shadow-none sm:p-10">
          <header className="flex items-start justify-between border-b border-line pb-5">
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">Tenant Record</h1>
              <p className="mt-1 text-sm text-ink-muted">Resident verification — for police reporting</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-mono font-semibold text-ink">{tenant.reg_no ?? "—"}</p>
              <p className="text-ink-muted">{pg?.pg_name}</p>
            </div>
          </header>

          {/* identity + profile photo */}
          <section className="mt-6 flex gap-5">
            {tenant.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.avatar_url}
                alt="Tenant"
                loading="eager"
                className="h-40 w-32 shrink-0 rounded-xl border border-line bg-paper-2 object-cover"
                style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
              />
            ) : aadhaarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={aadhaarUrl}
                alt="Tenant ID"
                loading="eager"
                className="h-40 w-32 shrink-0 rounded-xl border border-line bg-paper-2 object-contain"
                style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
              />
            ) : (
              <div className="grid h-40 w-32 shrink-0 place-items-center rounded-xl border border-dashed border-line text-xs text-ink-muted">
                No photo
              </div>
            )}
            <div className="grid flex-1 grid-cols-2 gap-4 self-center">
              <Field label="Name" value={tenant.name} />
              <Field label="Phone" value={tenant.phone} />
              <Detail label="Aadhaar / ID" value={tenant.aadhaar_number} />
              <Field label="Status" value={tenant.status === "checked_out" ? "Vacated" : "Staying"} />
            </div>
          </section>

          {/* personal details — each printed only when it has a value */}
          {hasDetails && (
            <section className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-line bg-paper-2/40 p-5 sm:grid-cols-3">
              <Detail label="Parent's phone" value={tenant.parent_phone} />
              <Detail label="Other contact" value={tenant.guardian} />
              <Detail label="Vehicle number" value={tenant.vehicle_number} />
              <Detail label="Email" value={tenant.email} />
              <Detail label="Occupation" value={occupationText} />
              <Detail label="Institute / Company" value={tenant.organization} />
              <Detail label="Monthly rent" value={tenant.rent_amount ? inr(tenant.rent_amount) : null} />
              <Detail label="Security deposit" value={tenant.security_deposit ? inr(tenant.security_deposit) : null} />
              {tenant.address && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Address</p>
                  <p className="mt-1 font-medium text-ink">{tenant.address}</p>
                </div>
              )}
            </section>
          )}

          {/* ID document — the Aadhaar / proof card uploaded at check-in, shown
              large and uncropped so it is clearly legible on the printed page. */}
          {aadhaarUrl && (
            <section className="mt-6 break-inside-avoid">
              <h2 className="font-display text-lg text-ink">Identity document</h2>
              <p className="mb-2 text-xs text-ink-muted">Aadhaar / ID proof submitted at check-in.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={aadhaarUrl}
                alt="Aadhaar / ID proof"
                loading="eager"
                className="w-full max-w-md rounded-xl border border-line bg-white object-contain"
                style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
              />
            </section>
          )}

          {/* stay */}
          <section className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-line bg-paper-2/40 p-5 sm:grid-cols-4">
            <Field label="Floor" value={room ? `Floor ${room.floor}` : "—"} />
            <Field label="Room" value={room ? room.room_number : "—"} />
            <Field label="Check-in" value={formatDate(tenant.checkin_date)} />
            <Field
              label="Check-out"
              value={tenant.checkout_date ? formatDate(tenant.checkout_date) : "Currently staying"}
            />
          </section>

          {/* activity timeline */}
          <section className="mt-6">
            <h2 className="font-display text-lg text-ink">Stay timeline</h2>
            {events.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No recorded activity.</p>
            ) : (
              <ol className="mt-3 space-y-2.5">
                {events.map((e) => (
                  <li key={e.id} className="flex items-baseline gap-3 text-sm">
                    <span className="w-28 shrink-0 text-ink-muted tnum">{formatDate(e.created_at)}</span>
                    <span className="font-medium text-ink">{EVENT_LABEL[e.type]}</span>
                    {e.detail && <span className="text-ink-soft">— {e.detail}</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* additional ID documents (DL / passport / voter / other) */}
          {documents.length > 0 && (
            <section className="mt-6 break-inside-avoid">
              <h2 className="font-display text-lg text-ink">ID documents</h2>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {documents.map((d) => (
                  <div key={d.id} className="overflow-hidden rounded-xl border border-line">
                    {d.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.url}
                        alt={DOC_LABELS[d.doc_type]}
                        loading="eager"
                        className="h-32 w-full bg-white object-contain"
                        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
                      />
                    )}
                    <p className="px-2.5 py-1.5 text-xs font-semibold text-ink">
                      {d.label || DOC_LABELS[d.doc_type]}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* resident agreement + signatures (only if configured) */}
          <div className="mt-6">
            <SignedAgreement pgId={tenant.pg_id} tenantId={tenant.id} tenantName={tenant.name} />
          </div>

          <footer className="mt-10 flex items-end justify-between border-t border-line pt-5">
            <p className="max-w-xs text-xs text-ink-muted">
              {pg?.pg_name}
              {pg?.property_address ? ` · ${pg.property_address}` : ""}
            </p>
            <div className="text-center">
              <div className="h-12 w-40 border-b border-ink/40" />
              <p className="mt-1 text-xs text-ink-muted">Owner signature</p>
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}
