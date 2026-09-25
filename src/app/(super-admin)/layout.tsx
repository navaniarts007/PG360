import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/guards";
import { getMyNotifications } from "@/lib/db";

// Every page under here needs a live session + a live DB read — never safe
// to statically prerender. Without this, `next build` attempts to prerender
// these routes anyway and executes real MySQL queries with no credentials
// available in the build environment (this crashed the build in testing:
// ER_ACCESS_DENIED_ERROR trying to reach a default localhost MySQL).
export const dynamic = "force-dynamic";

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
      properties={user.properties}
      activePropertyId={user.activePropertyId}
      settings={{}}
    >
      {children}
    </AppShell>
  );
}
