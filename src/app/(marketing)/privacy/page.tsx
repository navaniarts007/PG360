import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/page-hero";
import { LegalDoc } from "@/components/marketing/legal-doc";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy" accent="Policy" />
      <LegalDoc
        updated="21 June 2026"
        sections={[
          {
            h: "1. What we collect",
            p: [
              "Account details (name, email, phone), property and tenant records you enter (rooms, rent, payments, complaints), and basic usage/diagnostic data needed to run the Service.",
            ],
          },
          {
            h: "2. How we use it",
            p: [
              "To provide PG360 — managing your property, showing tenants their bills, sending in-app notifications, and improving the product. We do not sell your data.",
            ],
          },
          {
            h: "3. Where it's stored (data residency)",
            p: [
              "Your data is hosted on Supabase in the Mumbai (ap-south-1) region — i.e. within India. Access is enforced by row-level security so each owner, staff member and tenant only sees their own data.",
            ],
          },
          {
            h: "4. Sharing",
            p: [
              "We share data only with infrastructure providers needed to operate the Service (e.g. hosting, image storage) under appropriate safeguards, or where required by law.",
            ],
          },
          {
            h: "5. Your rights",
            p: [
              "You can access, correct or delete your data. Owners can remove tenants and their records; deleting your account removes your property data. Email contact@pg360.software for any request.",
            ],
          },
          {
            h: "6. Security",
            p: [
              "We use encryption in transit, row-level security, and least-privilege access. See our Security page for more.",
            ],
          },
        ]}
      />
    </>
  );
}
