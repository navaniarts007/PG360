import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { MoneySettingsForm } from "@/components/admin/money-settings-form";
import { WifiNetworksCard } from "@/components/admin/wifi-networks-card";
import { PaymentDetailsCard } from "@/components/admin/payment-details-card";
import { AgreementSectionsCard } from "@/components/admin/agreement-sections-card";
import { requireRole } from "@/lib/guards";
import { getActiveProperty } from "@/lib/auth";
import { getKycSignedUrl, getPgAccount, getPgPolicy, listAgreementSections, listWifiNetworks } from "@/lib/db";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole(["admin"]);
  const pid = await getActiveProperty();
  if (!pid) notFound();
  const [pg, policy, wifiNetworks, sections] = await Promise.all([
    getPgAccount(pid),
    getPgPolicy(pid),
    listWifiNetworks(),
    listAgreementSections(pid),
  ]);
  if (!pg) notFound();
  const ownerSignatureUrl = await getKycSignedUrl(pg.owner_signature_url);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={pg.pg_name}
        title="Settings"
        subtitle="Tune the modules, money rules and receipt details for this property."
      />

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Modules</h2>
        <div className="max-w-2xl">
          <SettingsForm settings={pg.settings ?? {}} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
          Payment details
        </h2>
        <div className="max-w-2xl">
          <PaymentDetailsCard
            upiId={pg.upi_id ?? null}
            bankDetails={pg.bank_details ?? null}
            qrUrl={pg.payment_qr_url ?? null}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">WiFi</h2>
        <div className="max-w-2xl">
          <WifiNetworksCard networks={wifiNetworks} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
          Money model
        </h2>
        <div className="max-w-2xl">
          <MoneySettingsForm pg={pg} policy={policy} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
          Resident agreement
        </h2>
        <div className="max-w-2xl">
          <AgreementSectionsCard sections={sections} ownerSignatureUrl={ownerSignatureUrl} />
        </div>
      </section>
    </div>
  );
}
