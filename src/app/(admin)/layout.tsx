import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/guards";
import { getMyNotifications, getPgAccount } from "@/lib/db";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["admin", "staff"]);
  const [pg, notifications] = await Promise.all([
    user.pg_id ? getPgAccount(user.pg_id) : Promise.resolve(null),
    getMyNotifications(),
  ]);
  return (
    <AppShell
      role={user.role}
      user={{ full_name: user.full_name, email: user.email }}
      context={pg?.pg_name ?? "Your PG"}
      userId={user.id}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}
