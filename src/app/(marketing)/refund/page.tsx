import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/page-hero";
import { LegalDoc } from "@/components/marketing/legal-doc";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Refund" accent="Policy" />
      <LegalDoc
        updated="21 June 2026"
        sections={[
          {
            h: "1. Subscriptions",
            p: [
              "PG360 plans are billed in advance (yearly, or once for Lifetime). You can start free and only pay when you're ready.",
            ],
          },
          {
            h: "2. 7-day money-back",
            p: [
              "If a paid plan isn't right for you, request a full refund within 7 days of payment and we'll process it — no questions asked.",
            ],
          },
          {
            h: "3. After 7 days",
            p: [
              "Beyond the 7-day window, payments for the current term are non-refundable, but you can cancel anytime to stop future renewals and keep access until the term ends.",
            ],
          },
          {
            h: "4. Tenant rent",
            p: [
              "Rent paid by tenants goes directly to the PG owner (e.g. via the owner's UPI). PG360 does not hold or refund rent — refunds of rent are between the tenant and the owner.",
            ],
          },
          {
            h: "5. How to request",
            p: [
              "Email contact@pg360.software from your registered address with your account details. Approved refunds are returned to the original payment method within 5–7 business days.",
            ],
          },
        ]}
      />
    </>
  );
}
