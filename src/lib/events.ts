import "server-only";
import { query } from "./mysql/client";
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
    await query(
      `insert into tenant_events (pg_id, tenant_id, event_type, detail, room_id, floor, created_by)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.pgId,
        input.tenantId,
        input.type,
        input.detail ?? null,
        input.roomId ?? null,
        input.floor ?? null,
        input.createdBy ?? null,
      ],
    );
  } catch {
    /* timeline is non-critical — swallow */
  }
}
