"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { query } from "../mysql/client";

export type ActionState = { ok?: boolean; error?: string };

const wifiSchema = z.object({
  ssid: z.string().min(1, "Network name is required."),
  password: z.string().min(1, "WiFi password is required."),
});

export async function createWifiAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const parsed = wifiSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    await query(`insert into wifi_networks (pg_id, ssid, password) values (?, ?, ?)`, [
      pid,
      parsed.data.ssid,
      parsed.data.password,
    ]);
  } catch (error) {
    const msg = (error as { message?: string })?.message ?? "";
    return { error: /duplicate|unique/i.test(msg) ? "A network with that name already exists." : msg };
  }
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/** Edit a network — the new SSID/password propagate to every room using it so
 *  there's a single source of truth. */
export async function updateWifiAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const id = String(formData.get("id"));
  const parsed = wifiSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  // pg_id = ? fixes a cross-tenant write gap the original had (id-only,
  // relying entirely on RLS).
  await query(`update wifi_networks set ssid = ?, password = ? where id = ? and pg_id = ?`, [
    parsed.data.ssid,
    parsed.data.password,
    id,
    pid,
  ]);

  // keep rooms in sync — also pg-scoped, though wifi_network_id already
  // implies the same property via the FK
  await query(
    `update rooms set wifi_ssid = ?, wifi_password = ? where wifi_network_id = ? and pg_id = ?`,
    [parsed.data.ssid, parsed.data.password, id, pid],
  );

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/rooms");
  return { ok: true };
}

export async function deleteWifiAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  // rooms.wifi_network_id is set null by the FK; their last-known password stays.
  await query(`delete from wifi_networks where id = ? and pg_id = ?`, [id, pid]);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/rooms");
}
