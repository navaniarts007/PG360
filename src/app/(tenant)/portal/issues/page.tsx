import type { Metadata } from "next";
import {
  Droplets,
  MessagesSquare,
  Sparkles,
  Volume2,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { IssueStatusPill } from "@/components/ui/status";
import { RaiseIssueForm } from "@/components/tenant/raise-issue-form";
import { requireRole } from "@/lib/guards";
import { getMyIssues } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Complaints" };

const CATEGORY: Record<string, { label: string; icon: LucideIcon }> = {
  electricity: { label: "Electricity", icon: Zap },
  plumbing: { label: "Plumbing", icon: Droplets },
  wifi: { label: "WiFi", icon: Wifi },
  cleaning: { label: "Cleaning", icon: Sparkles },
  noise: { label: "Noise", icon: Volume2 },
  other: { label: "Other", icon: MessagesSquare },
};

export default async function TenantIssues() {
  await requireRole(["tenant"]);
  const issues = await getMyIssues();

  return (
    <div className="space-y-7">
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-clay-500">
          Support
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-[2.1rem]">
          Complaints
        </h1>
        <p className="mt-1.5 text-ink-soft">Raise an issue and track it to resolved.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Card className="h-fit p-5 sm:p-6">
          <h3 className="text-lg text-ink">Raise a complaint</h3>
          <p className="mt-0.5 text-sm text-ink-muted">We&apos;ll notify your PG owner instantly.</p>
          <div className="mt-5">
            <RaiseIssueForm />
          </div>
        </Card>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Your complaints ({issues.length})
          </h3>
          {issues.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-ink-muted">No complaints yet. All good! 🎉</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {issues.map((issue) => {
                const cat = CATEGORY[issue.category] ?? CATEGORY.other!;
                const Icon = cat.icon;
                return (
                  <Card key={issue.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-paper-2 text-clay-600 ring-1 ring-line">
                          <Icon className="size-4.5" />
                        </span>
                        <div>
                          <p className="font-semibold text-ink">{cat.label}</p>
                          <p className="mt-0.5 text-sm text-ink-soft">{issue.description}</p>
                          <p className="mt-1 text-xs text-ink-muted">
                            Raised {formatDate(issue.created_at)}
                            {issue.resolved_at && ` · Resolved ${formatDate(issue.resolved_at)}`}
                          </p>
                        </div>
                      </div>
                      <IssueStatusPill status={issue.status} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
