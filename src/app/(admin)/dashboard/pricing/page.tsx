import type { Metadata } from "next";
import { Tag } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RateCardDialog } from "@/components/admin/rate-card-dialog";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { deleteRateCardAction } from "@/lib/actions/ratecard";
import { requireRole } from "@/lib/guards";
import { listRateCards } from "@/lib/db";
import { inr } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing" };

const SHARING: Record<string, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  quad: "Four sharing",
  dorm: "Dormitory",
};

export default async function PricingPage() {
  await requireRole(["admin", "staff"]);
  const cards = await listRateCards();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Rate card"
        title="Pricing"
        subtitle="Set per-bed monthly prices by sharing type. Rooms and tenants price from these."
        action={<RateCardDialog />}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No rate cards yet"
          body="Add your sharing-type prices (e.g. Double Sharing AC ₹12,000) — then rooms auto-price their beds."
          action={<RateCardDialog />}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-2/40 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-6 py-3.5 font-semibold">Name</th>
                  <th className="px-6 py-3.5 font-semibold">Sharing</th>
                  <th className="px-6 py-3.5 font-semibold">AC / Bath</th>
                  <th className="px-6 py-3.5 font-semibold">Food</th>
                  <th className="px-6 py-3.5 font-semibold">Price / bed</th>
                  <th className="px-6 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((rc) => (
                  <tr key={rc.id} className="border-b border-line last:border-0 hover:bg-paper-2/30">
                    <td className="px-6 py-3.5 font-semibold text-ink">{rc.name}</td>
                    <td className="px-6 py-3.5 text-ink-soft">{SHARING[rc.room_type] ?? rc.room_type}</td>
                    <td className="px-6 py-3.5">
                      <span className="flex flex-wrap gap-1.5">
                        <Badge tone={rc.ac ? "clay" : "neutral"}>{rc.ac ? "AC" : "Non-AC"}</Badge>
                        <Badge tone="neutral" className="capitalize">{rc.bath_type}</Badge>
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      {rc.food_included ? (
                        <Badge tone="teal">Included</Badge>
                      ) : (
                        <Badge tone="neutral">Extra</Badge>
                      )}
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-ink tnum">
                      {inr(rc.price_per_month)}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <RateCardDialog card={rc} />
                        <ConfirmDelete action={deleteRateCardAction} id={rc.id} title="Delete rate card" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
