import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/guards";
import { getMyNotifications, getPgAccount } from "@/lib/db";
import { getEdition } from "@/lib/get-client";

// See (super-admin)/layout.tsx — same reasoning, force-dynamic prevents
// next build from trying to prerender these with real DB queries.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["admin", "staff"]);
  // First-login terms acceptance (skipped for an impersonating super-admin).
  if (!user.termsAcceptedAt && !user.impersonating) redirect("/accept-terms");
  const [pg, notifications, client] = await Promise.all([
    user.activePropertyId ? getPgAccount(user.activePropertyId) : Promise.resolve(null),
    getMyNotifications(),
    getEdition(),
  ]);

  // Demo / trial accounts: lock once the trial date has passed (owners only;
  // a super-admin impersonating can still get in to extend/convert it).
  const demoExpired =
    !!pg?.is_demo &&
    pg.subscription_expiry < new Date().toISOString().slice(0, 10);
  if (demoExpired && !user.impersonating) redirect("/demo-expired");

  return (
    <AppShell
      demoExpiry={pg?.is_demo ? pg.subscription_expiry : null}
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
      logoSrc={client.logoSrc}
      impersonating={user.impersonating ?? null}
      permissions={user.permissions ?? null}
    >
      {children}
    </AppShell>
  );
}
