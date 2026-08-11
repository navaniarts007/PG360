import type { Metadata } from "next";
import { ExternalLink, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { ChangePasswordCard } from "@/components/app/change-password-card";
import { requireRole } from "@/lib/guards";
import { getMyPg } from "@/lib/db";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  await requireRole(["tenant"]);
  const pg = await getMyPg();

  return (
    <div className="space-y-7">
      <PageHeader
        title="Account"
        subtitle="Manage how you sign in to your resident portal."
      />
      <div className="max-w-2xl space-y-7">
        {pg?.rules_doc_url && (
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
                <ScrollText className="size-5" />
              </span>
              <div>
                <h3 className="text-lg text-ink">Rules &amp; Regulations</h3>
                <p className="text-sm text-ink-muted">
                  Official property policies and house guidelines.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-line bg-paper-2/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    PG Rules &amp; Regulations Document
                  </p>
                  <p className="text-xs text-ink-muted">
                    Provided by {pg.pg_name}
                  </p>
                </div>
                <a
                  href={pg.rules_doc_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-clay-600 hover:bg-paper-2"
                >
                  <ExternalLink className="size-3.5" /> View / Download Document
                </a>
              </div>
            </div>
          </Card>
        )}

        <ChangePasswordCard />
      </div>
    </div>
  );
}
