import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireRole } from "@/lib/guards";
import { getActiveProperty } from "@/lib/auth";
import { getPgAccount } from "@/lib/db";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole(["admin"]);
  const pid = await getActiveProperty();
  const pg = pid ? await getPgAccount(pid) : null;
  if (!pg) notFound();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={pg.pg_name}
        title="Settings"
        subtitle="Enable only the modules this property needs — the rest disappear from the menu."
      />
      <div className="max-w-2xl">
        <SettingsForm settings={pg.settings ?? {}} />
      </div>
    </div>
  );
}
