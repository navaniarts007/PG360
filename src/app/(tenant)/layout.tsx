import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/guards";
import { getMyNotifications, getMyPg } from "@/lib/db";
import { getClient } from "@/lib/get-client";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Editions without a tenant portal (e.g. GVM) never serve /portal.
  const client = await getClient();
  if (!client.portalEnabled) redirect("/dashboard");

  const user = await requireRole(["tenant"]);
  const [pg, notifications] = await Promise.all([getMyPg(), getMyNotifications()]);
  return (
    <AppShell
      role={user.role}
      user={{ full_name: user.full_name, email: user.email }}
      context={pg?.pg_name ?? "My PG"}
      userId={user.id}
      notifications={notifications}
      properties={user.properties}
      activePropertyId={user.activePropertyId}
      settings={pg?.settings ?? {}}
    >
      {children}
    </AppShell>
  );
}
