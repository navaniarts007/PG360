"use server";

import { revalidatePath } from "next/cache";
import { humanizeDbError } from "../errors";
import { z } from "zod";
import { requireRole } from "../guards";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { notifyStaff } from "../notify";

export type ActionState = { ok?: boolean; error?: string };

const bookingSchema = z.object({
  pg_id: z.string().uuid("Invalid PG."),
  tenant_name: z.string().min(2, "Enter your name."),
  phone: z.string().min(8, "Enter a valid phone."),
  preferred_room_type: z.enum(["single", "double", "triple", "any"]),
  requested_date: z.string().optional(),
  notes: z.string().optional(),
});

/** PUBLIC: anyone can submit a room request. Inserted via the service client
 *  after validating the target PG exists and is active. */
export async function createBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  const admin = createAdminClient();
  const { data: pg } = await admin
    .from("pg_accounts")
    .select("id, status")
    .eq("id", d.pg_id)
    .maybeSingle();
  if (!pg || pg.status !== "active") return { error: "This PG isn't accepting requests." };

  const { error } = await admin.from("bookings").insert({
    pg_id: d.pg_id,
    tenant_name: d.tenant_name,
    phone: d.phone,
    preferred_room_type: d.preferred_room_type,
    requested_date: d.requested_date || null,
    notes: d.notes || null,
  });
  if (error) return { error: humanizeDbError(error) };

  await notifyStaff(
    d.pg_id,
    `New room request from ${d.tenant_name} (${d.preferred_room_type})`,
    "/dashboard/bookings",
  );
  return { ok: true };
}

export async function setBookingStatusAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["pending", "approved", "rejected"].includes(status)) return;
  const s = await createClient();
  await s.from("bookings").update({ status }).eq("id", id);
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
}

const bookingUpdateSchema = z.object({
  tenant_name: z.string().min(2, "Enter a name."),
  phone: z.string().min(8, "Enter a valid phone."),
  preferred_room_type: z.enum(["single", "double", "triple", "any"]),
  requested_date: z.string().optional(),
  notes: z.string().optional(),
});

export async function updateBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const parsed = bookingUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const s = await createClient();
  const { error } = await s
    .from("bookings")
    .update({
      tenant_name: d.tenant_name,
      phone: d.phone,
      preferred_room_type: d.preferred_room_type,
      requested_date: d.requested_date || null,
      notes: d.notes || null,
    })
    .eq("id", id);
  if (error) return { error: humanizeDbError(error) };
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteBookingAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const s = await createClient();
  await s.from("bookings").delete().eq("id", id);
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
}
