import type { Metadata } from "next";
import { ShieldCheck, UserCog } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Filterable } from "@/components/app/filterable";
import { StaffPermissionsDialog } from "@/components/admin/staff-permissions-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AddStaffDialog } from "@/components/admin/add-staff-dialog";
import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { deleteStaffAction } from "@/lib/actions/staff";
import { requireRole } from "@/lib/guards";
import { listStaff } from "@/lib/db";
import { initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  await requireRole(["admin"]);
  const members = await listStaff();
  const staff = members.filter((m) => m.role === "staff");
  const owners = members.filter((m) => m.role === "admin");

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Team"
        title="Staff"
        subtitle="People who can help manage this property."
        action={<AddStaffDialog />}
      />

      <Filterable
        placeholder="Search team by name or phone…"
        filters={[
          {
            key: "role",
            label: "Role",
            options: [
              { label: "All", value: "" },
              { label: "Owner", value: "admin" },
              { label: "Staff", value: "staff" },
            ],
          },
        ]}
      >
      <Card>
        <div className="border-b border-line p-5 sm:p-6">
          <h3 className="text-lg text-ink">Members</h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            {owners.length} owner{owners.length === 1 ? "" : "s"} · {staff.length} staff
          </p>
        </div>
        {members.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={UserCog}
              title="No team members yet"
              body="Add a staff member to share the day-to-day work."
              action={<AddStaffDialog />}
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {members.map((m) => {
              const isOwner = m.role === "admin";
              return (
                <div
                  key={m.id}
                  data-search={`${m.full_name} ${m.phone ?? ""}`}
                  data-role={m.role}
                  className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-paper">
                      {initials(m.full_name)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{m.full_name}</p>
                      <p className="text-xs text-ink-muted">{m.phone ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isOwner ? (
                      <Badge tone="clay" className="gap-1">
                        <ShieldCheck className="size-3.5" /> Owner
                      </Badge>
                    ) : (
                      <Badge tone="teal">Staff</Badge>
                    )}
                    {!isOwner && (
                      <>
                        <StaffPermissionsDialog id={m.id} name={m.full_name} permissions={m.permissions} />
                        <ConfirmDelete
                          action={deleteStaffAction}
                          id={m.id}
                          title="Remove staff"
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      </Filterable>
    </div>
  );
}
