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
import { PageHeader } from "@/components/app/page-header";
import { Filterable } from "@/components/app/filterable";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IssueStatusControl } from "@/components/admin/issue-status-control";
import { IssueEditDialog } from "@/components/admin/issue-edit-dialog";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { deleteIssueAction } from "@/lib/actions/admin";
import { requireRole } from "@/lib/guards";
import { listIssuesWithTenant } from "@/lib/db";

export const metadata: Metadata = { title: "Complaints" };

const CATEGORY: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  electricity: { label: "Electricity", icon: Zap, tone: "bg-gold-50 text-gold-600 ring-gold-100" },
  plumbing: { label: "Plumbing", icon: Droplets, tone: "bg-teal-50 text-teal-600 ring-teal-100" },
  wifi: { label: "WiFi", icon: Wifi, tone: "bg-clay-50 text-clay-600 ring-clay-100" },
  cleaning: { label: "Cleaning", icon: Sparkles, tone: "bg-teal-50 text-teal-600 ring-teal-100" },
  noise: { label: "Noise", icon: Volume2, tone: "bg-rose-50 text-rose-600 ring-rose-100" },
  other: { label: "Other", icon: MessagesSquare, tone: "bg-paper-2 text-ink-soft ring-line" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function IssuesPage() {
  await requireRole(["admin", "staff"]);
  const issues = await listIssuesWithTenant();
  const open = issues.filter((i) => i.status !== "resolved").length;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Support"
        title="Complaints"
        subtitle={`${open} open · ${issues.length - open} resolved`}
      />

      {issues.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="No complaints" body="When tenants raise issues, they show up here." />
      ) : (
        <Filterable
          placeholder="Search complaints by tenant, room or text…"
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { label: "All", value: "" },
                { label: "Open", value: "open" },
                { label: "In progress", value: "in_progress" },
                { label: "Resolved", value: "resolved" },
              ],
            },
          ]}
        >
        <div className="space-y-3">
          {issues.map((issue) => {
            const cat = CATEGORY[issue.category] ?? CATEGORY.other!;
            const Icon = cat.icon;
            return (
              <Card
                key={issue.id}
                data-search={`${cat.label} ${issue.description} ${issue.tenant_name} ${issue.room_number ? `room ${issue.room_number}` : ""}`}
                data-status={issue.status}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex gap-4">
                  <span className={`grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${cat.tone}`}>
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink">{cat.label}</p>
                      <span className="text-xs text-ink-muted">· {timeAgo(issue.created_at)}</span>
                    </div>
                    <p className="mt-0.5 max-w-xl text-sm text-ink-soft">{issue.description}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {issue.tenant_name}
                      {issue.room_number ? ` · Room ${issue.room_number}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                  <IssueStatusControl id={issue.id} status={issue.status} />
                  <IssueEditDialog
                    id={issue.id}
                    category={issue.category}
                    description={issue.description}
                  />
                  <ConfirmDelete action={deleteIssueAction} id={issue.id} title="Delete complaint" />
                </div>
              </Card>
            );
          })}
        </div>
        </Filterable>
      )}
    </div>
  );
}
