import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/guards";
import { getMyNotifications } from "@/lib/db";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["super_admin"]);
  const notifications = await getMyNotifications();
  return (
    <AppShell
      role={user.role}
      user={{ full_name: user.full_name, email: user.email }}
      context="PG360 Platform"
      userId={user.id}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}
