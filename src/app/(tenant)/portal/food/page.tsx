import type { Metadata } from "next";
import { UtensilsCrossed } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { FoodMenuView } from "@/components/tenant/food-menu-view";
import { requireRole } from "@/lib/guards";
import { getFoodMenu } from "@/lib/db";
import { weekDates } from "@/lib/utils";

export const metadata: Metadata = { title: "Food menu" };

export default async function TenantFood() {
  await requireRole(["tenant"]);
  const week = weekDates();
  const items = await getFoodMenu();

  const menu: Record<string, string> = {};
  for (const it of items) menu[`${it.day_of_week}_${it.meal_type}`] = it.description;

  const hasMenu = items.some((i) => i.description.trim().length > 0);

  return (
    <div className="space-y-7">
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-clay-500">
          This week
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-[2.1rem]">
          Food menu
        </h1>
        <p className="mt-1.5 text-ink-soft">
          Here&apos;s what&apos;s being served this week.
        </p>
      </div>

      {!hasMenu ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No menu yet"
          body="Your PG owner hasn't published this week's menu. Check back soon."
        />
      ) : (
        <FoodMenuView week={week} menu={menu} />
      )}
    </div>
  );
}
