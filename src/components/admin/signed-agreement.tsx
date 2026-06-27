import { FileSignature } from "lucide-react";
import {
  getKycSignedUrl,
  getPgAccount,
  getTenantAgreement,
  listAgreementSections,
} from "@/lib/db";
import { formatDate } from "@/lib/utils";

/** The resident agreement for one tenant: the policy sections + the owner and
 *  tenant signatures. Renders nothing if the PG has no agreement configured.
 *  Used on the admin profile and the printable record. */
export async function SignedAgreement({
  pgId,
  tenantId,
  tenantName,
}: {
  pgId: string;
  tenantId: string;
  tenantName: string;
}) {
  const [sections, agreement, pg] = await Promise.all([
    listAgreementSections(pgId),
    getTenantAgreement(tenantId),
    getPgAccount(pgId),
  ]);
  if (sections.length === 0) return null;

  const [ownerSig, tenantSig] = await Promise.all([
    getKycSignedUrl(pg?.owner_signature_url ?? null),
    getKycSignedUrl(agreement?.signature_url ?? null),
  ]);

  return (
    <section className="break-inside-avoid rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg text-ink">
          <FileSignature className="size-4.5 text-clay-500" /> Resident agreement
        </h2>
        {agreement ? (
          <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-100">
            Signed {formatDate(agreement.accepted_at)}
          </span>
        ) : (
          <span className="rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-semibold text-gold-700 ring-1 ring-gold-100">
            Not signed yet
          </span>
        )}
      </div>

      <ol className="mt-4 space-y-3">
        {sections.map((s, i) => (
          <li key={s.id} className="break-inside-avoid">
            <p className="text-sm font-semibold text-ink">{i + 1}. {s.title}</p>
            {s.body && <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-soft">{s.body}</p>}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid grid-cols-2 gap-5 border-t border-line pt-5">
        <Sig label="For the management" url={ownerSig} caption={pg?.owner_name ?? ""} />
        <Sig
          label="Resident"
          url={tenantSig}
          caption={agreement ? `${tenantName} · ${formatDate(agreement.accepted_at)}` : tenantName}
        />
      </div>
    </section>
  );
}

function Sig({ label, url, caption }: { label: string; url: string | null; caption: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <div className="grid h-20 place-items-center rounded-lg border border-line bg-paper-2/40">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="max-h-[72px] object-contain" />
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-soft">{caption}</p>
    </div>
  );
}
