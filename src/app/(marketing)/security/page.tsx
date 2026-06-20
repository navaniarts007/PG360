import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/page-hero";
import { LegalDoc } from "@/components/marketing/legal-doc";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <>
      <PageHero eyebrow="Trust" title="Security at" accent="PG360" />
      <LegalDoc
        updated="21 June 2026"
        sections={[
          {
            h: "Row-level security (RLS)",
            p: [
              "Every table is protected by Postgres row-level security. Owners and staff can only read their own properties; tenants can only read their own room, bills and complaints. Isolation is enforced in the database, not just the UI.",
            ],
          },
          {
            h: "Data residency — India",
            p: [
              "Your database, authentication and files are hosted in the Mumbai (ap-south-1) region, keeping data within India for compliance and privacy.",
            ],
          },
          {
            h: "Authentication",
            p: [
              "Logins are handled by Supabase Auth with securely hashed passwords. Sessions use httpOnly cookies; the service-role key never reaches the browser.",
            ],
          },
          {
            h: "Encryption",
            p: [
              "All traffic is served over HTTPS (TLS), with HSTS enabled. Payment screenshots and documents are stored privately with scoped access.",
            ],
          },
          {
            h: "Least privilege",
            p: [
              "Staff get only the access their role needs. Sensitive operations run server-side after an explicit role check.",
            ],
          },
          {
            h: "Report an issue",
            p: [
              "Found a vulnerability? Please email contact@pg360.software — we take reports seriously and will respond quickly.",
            ],
          },
        ]}
      />
    </>
  );
}
