"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { query, queryOne } from "../mysql/client";
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

  const tenant = await queryOne<{ id: string; name: string }>(
    `select id, name from tenants where id = ? and pg_id = ?`,
    [tenantId, pid],
  );
  if (!tenant) return;

  const decidedBy = UUID_REGEX.test(user.id) ? user.id : null;

  try {
    await query(
      `insert into renewal_checks (pg_id, tenant_id, cycle_end, decision, decided_at, decided_by)
       values (?, ?, ?, ?, now(), ?)
       on duplicate key update decision = values(decision), decided_at = values(decided_at), decided_by = values(decided_by)`,
      [pid, tenantId, cycleEnd, decision, decidedBy],
    );
  } catch (err) {
    console.error("renewal_checks upsert error:", err);
  }

  const outcome =
    decision === "extend"
      ? `confirmed extending past ${formatDate(cycleEnd)}`
      : `confirmed vacating on ${formatDate(cycleEnd)}`;

  try {
    await Promise.all([
      logActivity("Renewal check", `${tenant.name} ${outcome}.`),
      query(
        `insert into tenant_events (pg_id, tenant_id, event_type, detail, created_by) values (?, ?, 'note', ?, ?)`,
        [pid, tenantId, `Renewal check: ${outcome}`, decidedBy],
      ),
    ]);
  } catch (err) {
    console.error("Renewal decision activity insert error:", err);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath(`/dashboard/tenants/${tenantId}`);
}
