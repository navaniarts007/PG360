import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/guards";
import { getMyPg } from "@/lib/db";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["tenant"]);
  const pg = await getMyPg();
  return (
    <AppShell
      role={user.role}
      user={{ full_name: user.full_name, email: user.email }}
      context={pg?.pg_name ?? "My PG"}
    >
      {children}
    </AppShell>
  );
}
