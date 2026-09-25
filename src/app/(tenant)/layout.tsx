import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/guards";
import { getMyNotifications, getMyPg, tenantNeedsAgreement } from "@/lib/db";
import { getEdition } from "@/lib/get-client";

// See (super-admin)/layout.tsx — same reasoning, force-dynamic prevents
// next build from trying to prerender these with real DB queries.
export const dynamic = "force-dynamic";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["tenant"]);
  // Editions without a tenant portal (e.g. GVM) never serve /portal.
  const client = await getEdition();
  if (!client.portalEnabled) redirect("/dashboard");
  // First login: if the PG has a resident agreement, sign it before continuing.
  if (await tenantNeedsAgreement()) redirect("/agreement");

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
      edition={client.edition}
      brandName={client.brandName}
      logoSrc={client.logoSrc}
    >
      {children}
    </AppShell>
  );
}
