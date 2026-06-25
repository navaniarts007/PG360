import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { CreatePgDialog } from "@/components/platform/create-pg-dialog";
import { AccountsTable } from "@/components/platform/accounts-table";
import { listPgAccounts } from "@/lib/db";

export const metadata: Metadata = { title: "PG accounts" };

export default async function AccountsPage() {
  const pgs = await listPgAccounts();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Super admin"
        title="PG accounts"
        subtitle="Onboard new owners, and suspend or reactivate any PG on the platform."
        action={<CreatePgDialog />}
      />

      <AccountsTable pgs={pgs} />
    </div>
  );
}
