"use server";

import { revalidatePath } from "next/cache";
import { humanizeDbError } from "../errors";
import { z } from "zod";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { createClient } from "../supabase/server";

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
  const s = await createClient();
  const { error } = await s.from("wifi_networks").insert({
    pg_id: pid,
    ssid: parsed.data.ssid,
    password: parsed.data.password,
  });
  if (error) {
    return {
      error: /duplicate|unique/i.test(error.message)
        ? "A network with that name already exists."
        : error.message,
    };
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
  const id = String(formData.get("id"));
  const parsed = wifiSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const s = await createClient();
  const { error } = await s
    .from("wifi_networks")
    .update({ ssid: parsed.data.ssid, password: parsed.data.password })
    .eq("id", id);
  if (error) return { error: humanizeDbError(error) };

  // keep rooms in sync
  await s
    .from("rooms")
    .update({ wifi_ssid: parsed.data.ssid, wifi_password: parsed.data.password })
    .eq("wifi_network_id", id);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/rooms");
  return { ok: true };
}

export async function deleteWifiAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const s = await createClient();
  // rooms.wifi_network_id is set null by the FK; their last-known password stays.
  await s.from("wifi_networks").delete().eq("id", id);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/rooms");
}
