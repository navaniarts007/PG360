import "server-only";
import { createAdminClient } from "./supabase/admin";
import type { TenantEventType } from "./types";

/**
 * Append an entry to a tenant's activity timeline (used by the police-style
 * profile + Vacated Master). Best-effort: never throws into the calling action.
 */
export async function logTenantEvent(input: {
  pgId: string;
  tenantId: string;
  type: TenantEventType;
  detail?: string;
  roomId?: string | null;
  floor?: number | null;
  createdBy?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("tenant_events").insert({
      pg_id: input.pgId,
      tenant_id: input.tenantId,
      type: input.type,
      detail: input.detail ?? null,
      room_id: input.roomId ?? null,
      floor: input.floor ?? null,
      created_by: input.createdBy ?? null,
    });
  } catch {
    /* timeline is non-critical — swallow */
  }
}
