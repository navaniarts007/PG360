import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { FoodMenuEditor } from "@/components/admin/food-menu-editor";
import { requireRole } from "@/lib/guards";
import { getFoodMenu } from "@/lib/db";

export const metadata: Metadata = { title: "Food menu" };

export default async function FoodPage() {
  await requireRole(["admin", "staff"]);
  const items = await getFoodMenu();
  const menu: Record<string, string> = {};
  for (const it of items) menu[`${it.day_of_week}_${it.meal_type}`] = it.description;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Mess"
        title="Weekly food menu"
        subtitle="Set the menu once — tenants see it and choose which meals they'll eat."
      />
      <FoodMenuEditor menu={menu} />
    </div>
  );
}
