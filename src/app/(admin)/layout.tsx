import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/guards";
import { getMyNotifications, getPgAccount } from "@/lib/db";
import { getEdition } from "@/lib/get-client";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["admin", "staff"]);
  const [pg, notifications, client] = await Promise.all([
    user.activePropertyId ? getPgAccount(user.activePropertyId) : Promise.resolve(null),
    getMyNotifications(),
    getEdition(),
  ]);
  return (
    <AppShell
      role={user.role}
      user={{ full_name: user.full_name, email: user.email }}
      context={pg?.pg_name ?? "Your PG"}
      userId={user.id}
      notifications={notifications}
      properties={user.properties}
      activePropertyId={user.activePropertyId}
      settings={pg?.settings ?? {}}
      edition={client.edition}
      brandName={client.brandName}
      impersonating={user.impersonating ?? null}
    >
      {children}
    </AppShell>
  );
}
