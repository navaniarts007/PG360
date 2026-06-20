import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/page-hero";
import { LegalDoc } from "@/components/marketing/legal-doc";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of" accent="Service" />
      <LegalDoc
        updated="21 June 2026"
        sections={[
          {
            h: "1. Agreement",
            p: [
              "These Terms govern your use of PG360 (the “Service”), operated by the PG360 team. By creating an account or using the Service, you agree to these Terms. If you are using PG360 on behalf of a business, you confirm you are authorised to bind that business.",
            ],
          },
          {
            h: "2. Accounts & roles",
            p: [
              "PG owners create an account to manage their property; staff and tenants are invited and access only the data their role permits. You are responsible for keeping login credentials secure and for activity under your account.",
            ],
          },
          {
            h: "3. Acceptable use",
            p: [
              "You agree to use PG360 lawfully and only for managing your own PG/hostel operations. You must not misuse the Service, attempt to access other accounts' data, or upload unlawful content.",
            ],
          },
          {
            h: "4. Payments & subscription",
            p: [
              "Paid plans are billed as shown on the Pricing page. Rent collected from tenants is settled directly to the owner (e.g. via the owner's own UPI) — PG360 records and reconciles payments but is not a party to the rent transaction unless explicitly stated.",
            ],
          },
          {
            h: "5. Data",
            p: [
              "You own your data. We process it to provide the Service as described in our Privacy Policy. Tenant and payment data are stored in India.",
            ],
          },
          {
            h: "6. Liability",
            p: [
              "The Service is provided “as is”. To the maximum extent permitted by law, PG360 is not liable for indirect or consequential losses. Nothing limits liability that cannot be limited under applicable law.",
            ],
          },
          {
            h: "7. Changes & contact",
            p: [
              "We may update these Terms; material changes will be notified in-app or by email. Questions? Email contact@pg360.software.",
            ],
          },
        ]}
      />
    </>
  );
}
