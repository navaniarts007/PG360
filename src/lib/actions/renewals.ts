"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { createClient } from "../supabase/server";
import { logActivity } from "../activity";
import { formatDate } from "../utils";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Record the outcome of a 30-day renewal check: the tenant confirmed they are
 *  extending another cycle, or that they will vacate on the cycle end date.
 *  Upserts the (tenant, cycle_end) row so the alert clears everywhere. */
export async function recordRenewalDecisionAction(formData: FormData): Promise<void> {
  const user = await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return;

  const tenantId = String(formData.get("tenant_id") ?? "");
  const cycleEnd = String(formData.get("cycle_end") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!tenantId || !/^\d{4}-\d{2}-\d{2}$/.test(cycleEnd)) return;
  if (decision !== "extend" && decision !== "vacate") return;

  const s = await createClient();
  const { data: tenant } = await s
    .from("tenants")
    .select("id, name")
    .eq("id", tenantId)
    .eq("pg_id", pid)
    .maybeSingle();
  if (!tenant) return;

  const decidedBy = UUID_REGEX.test(user.id) ? user.id : null;

  const { error: upsertErr } = await s.from("renewal_checks").upsert(
    {
      pg_id: pid,
      tenant_id: tenantId,
      cycle_end: cycleEnd,
      decision,
      decided_at: new Date().toISOString(),
      decided_by: decidedBy,
    },
    { onConflict: "tenant_id,cycle_end" },
  );

  if (upsertErr) {
    console.error("renewal_checks upsert error:", upsertErr);
  }

  const outcome =
    decision === "extend"
      ? `confirmed extending past ${formatDate(cycleEnd)}`
      : `confirmed vacating on ${formatDate(cycleEnd)}`;

  try {
    await Promise.all([
      logActivity("Renewal check", `${(tenant as { name: string }).name} ${outcome}.`),
      s.from("tenant_events").insert({
        pg_id: pid,
        tenant_id: tenantId,
        type: "note",
        detail: `Renewal check: ${outcome}`,
        created_by: decidedBy,
      }),
    ]);
  } catch (err) {
    console.error("Renewal decision activity insert error:", err);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath(`/dashboard/tenants/${tenantId}`);
}
