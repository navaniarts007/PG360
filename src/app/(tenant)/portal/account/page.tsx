import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { ChangePasswordCard } from "@/components/app/change-password-card";
import { requireRole } from "@/lib/guards";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  await requireRole(["tenant"]);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Account"
        subtitle="Manage how you sign in to your resident portal."
      />
      <div className="max-w-2xl">
        <ChangePasswordCard />
      </div>
    </div>
  );
}
