import type { Metadata } from "next";
import Link from "next/link";
import { Tag } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RateCardDialog } from "@/components/admin/rate-card-dialog";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { deleteRateCardAction } from "@/lib/actions/ratecard";
import { requireRole } from "@/lib/guards";
import { listRateCards, rateCardBedCounts } from "@/lib/db";
import { cn, inr } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing" };

const SHARING: Record<string, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  quad: "Four sharing",
  dorm: "Dormitory",
};

type FoodFilter = "all" | "included" | "extra";
const FILTERS: { key: FoodFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "included", label: "Food included" },
  { key: "extra", label: "Food extra" },
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ food?: string }>;
}) {
  await requireRole(["admin", "staff"]);
  const { food } = await searchParams;
  const filter: FoodFilter =
    food === "included" || food === "extra" ? food : "all";

  const [cards, bedCounts] = await Promise.all([listRateCards(), rateCardBedCounts()]);

  // #5 — when a food filter is chosen, show ONLY those cards (not both).
  const shown = cards.filter((rc) =>
    filter === "all" ? true : filter === "included" ? rc.food_included : !rc.food_included,
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Rate card"
        title="Pricing"
        subtitle="Set per-bed monthly prices by sharing type. Rooms and tenants price from these."
        action={<RateCardDialog />}
      />

      {cards.length > 0 && (
        <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-paper-2/50 p-1">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key === "all" ? "/dashboard/pricing" : `/dashboard/pricing?food=${f.key}`}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === f.key
                  ? "bg-clay-600 text-white"
                  : "text-ink-muted hover:bg-surface hover:text-ink",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      )}

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
                  <th className="px-6 py-3.5 font-semibold">Beds</th>
                  <th className="px-6 py-3.5 font-semibold">Rent / month</th>
                  <th className="px-6 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((rc) => {
                  // #4 — net rent when food is opted out (deduction subtracted).
                  const net = Math.max(0, rc.price_per_month - (rc.food_opt_out_deduction ?? 0));
                  const showNet = rc.food_included && (rc.food_opt_out_deduction ?? 0) > 0;
                  return (
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
                      <td className="px-6 py-3.5 text-ink-soft tnum">{bedCounts[rc.id] ?? 0}</td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-ink tnum">{inr(rc.price_per_month)}</span>
                        {showNet && (
                          <span className="block text-xs text-ink-muted tnum">
                            {inr(net)} without food
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <RateCardDialog card={rc} />
                          <ConfirmDelete action={deleteRateCardAction} id={rc.id} title="Delete rate card" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-ink-muted">
                      No rate cards match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
