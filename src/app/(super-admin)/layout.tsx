import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/guards";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["super_admin"]);
  return (
    <AppShell
      role={user.role}
      user={{ full_name: user.full_name, email: user.email }}
      context="PG360 Platform"
    >
      {children}
    </AppShell>
  );
}
