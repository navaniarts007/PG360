import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/guards";
import { getPgAccount } from "@/lib/db";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["admin", "staff"]);
  const pg = user.pg_id ? await getPgAccount(user.pg_id) : null;
  return (
    <AppShell
      role={user.role}
      user={{ full_name: user.full_name, email: user.email }}
      context={pg?.pg_name ?? "Your PG"}
    >
      {children}
    </AppShell>
  );
}
