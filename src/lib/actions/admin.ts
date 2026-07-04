"use server";

import { revalidatePath } from "next/cache";
import { humanizeDbError } from "../errors";
import { z } from "zod";
import { requireRole } from "../guards";
import { canDelete, canEdit } from "../perms";
import { logActivity } from "../activity";
import { getActiveProperty } from "../auth";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { notifyTenant } from "../notify";
import { computeBill, computeSettlement } from "../money";
import { getEdition } from "../get-client";
import { logTenantEvent } from "../events";

export type ActionState = { ok?: boolean; error?: string };

const amenityList = (s?: string) =>
  (s ?? "").split(",").map((a) => a.trim()).filter(Boolean);

/* --------------------------------- rooms --------------------------------- */
// A room is created against a rate card (sharing type + price); the system then
// auto-creates one bed per total_beds, each priced from the rate card.

const roomSchema = z.object({
  room_number: z.string().min(1, "Room number is required."),
  floor_id: z.string().min(1, "Pick a floor."),
  rate_card_id: z.string().min(1, "Pick a rate card."),
  total_beds: z.coerce.number().int().min(1, "At least 1 bed."),
  wifi_network_id: z.string().optional(),
  amenities: z.string().optional(),
});

/** Resolve a selected WiFi network into the room's denormalised wifi fields. */
async function resolveWifi(
  s: Awaited<ReturnType<typeof createClient>>,
  pid: string,
  wifiNetworkId: string | undefined,
): Promise<{ wifi_password: string; wifi_ssid: string | null; wifi_network_id: string | null }> {
  if (wifiNetworkId && wifiNetworkId !== "none") {
    const { data: w } = await s
      .from("wifi_networks")
      .select("*")
      .eq("id", wifiNetworkId)
      .maybeSingle();
    if (w && w.pg_id === pid) {
      return { wifi_password: w.password, wifi_ssid: w.ssid, wifi_network_id: w.id };
    }
  }
  return { wifi_password: "", wifi_ssid: null, wifi_network_id: null };
}

export async function addRoomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const parsed = roomSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const s = await createClient();

  const { data: rc } = await s
    .from("rate_cards")
    .select("*")
    .eq("id", d.rate_card_id)
    .maybeSingle();
  if (!rc || rc.pg_id !== pid) return { error: "That rate card isn't in this property." };

  const { data: floor } = await s
    .from("floors")
    .select("sort_order")
    .eq("id", d.floor_id)
    .maybeSingle();

  const wifi = await resolveWifi(s, pid, d.wifi_network_id);

  const { data: room, error } = await s
    .from("rooms")
    .insert({
      pg_id: pid,
      room_number: d.room_number,
      floor: floor?.sort_order ?? 0,
      floor_id: d.floor_id,
      type: rc.room_type,
      total_beds: d.total_beds,
      occupied_beds: 0,
      rent_amount: rc.price_per_month,
      ...wifi,
      amenities: amenityList(d.amenities),
    })
    .select()
    .single();
  if (error || !room) return { error: humanizeDbError(error, "Could not create the room.") };

  const beds = Array.from({ length: d.total_beds }, (_, i) => ({
    pg_id: pid,
    room_id: room.id,
    bed_number: `${d.room_number}-${i + 1}`,
    rate_card_id: rc.id,
    price_per_month: rc.price_per_month,
  }));
  const { error: bedErr } = await s.from("beds").insert(beds);
  if (bedErr) return { error: humanizeDbError(bedErr) };

  await logActivity("room.added", `Added room ${d.room_number} (${d.total_beds} beds)`);
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}

const roomUpdateSchema = z.object({
  room_number: z.string().min(1, "Room number is required."),
  floor_id: z.string().min(1, "Pick a floor."),
  total_beds: z.coerce.number().int().min(1, "At least 1 bed."),
  wifi_network_id: z.string().optional(),
  amenities: z.string().optional(),
  rate_card_id: z.string().optional(),
});

export async function updateRoomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["admin", "staff"]);
  if (!canEdit(me)) return { error: "You don't have permission to edit." };
  const id = String(formData.get("id"));
  const parsed = roomUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const s = await createClient();

  const { data: beds } = await s
    .from("beds")
    .select("id, status, bed_number")
    .eq("room_id", id)
    .order("bed_number");
  const current = beds ?? [];
  const occupied = current.filter((b) => b.status === "occupied").length;
  if (d.total_beds < occupied) {
    return { error: `Can't reduce below ${occupied} occupied bed(s).` };
  }

  const { data: floor } = await s
    .from("floors")
    .select("sort_order")
    .eq("id", d.floor_id)
    .maybeSingle();
  const pid = await getActiveProperty();
  const wifi = await resolveWifi(s, pid ?? "", d.wifi_network_id);
  const patch: Record<string, unknown> = {
    room_number: d.room_number,
    floor_id: d.floor_id,
    floor: floor?.sort_order ?? 0,
    total_beds: d.total_beds,
    ...wifi,
    amenities: amenityList(d.amenities),
  };
  let rcPrice: number | null = null;
  if (d.rate_card_id) {
    const { data: rc } = await s.from("rate_cards").select("*").eq("id", d.rate_card_id).maybeSingle();
    if (rc) {
      patch.type = rc.room_type;
      patch.rent_amount = rc.price_per_month;
      rcPrice = rc.price_per_month;
      await s
        .from("beds")
        .update({ rate_card_id: rc.id, price_per_month: rc.price_per_month })
        .eq("room_id", id);
    }
  }
  const { error } = await s.from("rooms").update(patch).eq("id", id);
  if (error) return { error: humanizeDbError(error) };

  // grow / shrink beds to match total_beds (only vacant beds are removable)
  if (d.total_beds > current.length) {
    const add = Array.from({ length: d.total_beds - current.length }, (_, i) => ({
      pg_id: undefined as unknown as string, // set below
      room_id: id,
      bed_number: `${d.room_number}-${current.length + i + 1}`,
      price_per_month: rcPrice ?? 0,
    }));
    // need pg_id — fetch from room
    const { data: room } = await s.from("rooms").select("pg_id, rent_amount").eq("id", id).maybeSingle();
    if (room) {
      await s.from("beds").insert(
        add.map((b) => ({
          pg_id: room.pg_id,
          room_id: id,
          bed_number: b.bed_number,
          price_per_month: rcPrice ?? room.rent_amount,
        })),
      );
    }
  } else if (d.total_beds < current.length) {
    const removable = current
      .filter((b) => b.status === "vacant")
      .slice(0, current.length - d.total_beds)
      .map((b) => b.id);
    if (removable.length) await s.from("beds").delete().in("id", removable);
  }

  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteRoomAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "staff"]);
  if (!canDelete(me)) return;
  const id = String(formData.get("id"));
  const s = await createClient();
  const { count } = await s
    .from("beds")
    .select("id", { count: "exact", head: true })
    .eq("room_id", id)
    .eq("status", "occupied");
  if ((count ?? 0) > 0) return; // block delete while any bed is occupied
  await s.from("rooms").delete().eq("id", id); // beds cascade
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
}

/* -------------------------------- tenants -------------------------------- */
// A tenant occupies a BED; rent derives from the bed's price.

const tenantSchema = z.object({
  name: z.string().min(2, "Name is required."),
  phone: z.string().min(8, "Enter a valid phone."),
  parent_phone: z.string().optional(),
  father_name: z.string().optional(),
  mother_name: z.string().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  organization: z.string().optional(),
  // login is optional — provide both email + password to give the tenant a portal login.
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  aadhaar_number: z.string().optional(),
  bed_id: z.string().optional(),
  security_deposit: z.coerce.number().min(0),
  checkin_date: z.string().min(1, "Check-in date is required."),
  rent_due_day: z.coerce.number().int().min(1).max(28),
  login_password: z.string().min(8, "Password must be 8+ characters.").optional().or(z.literal("")),
  joining_fee: z.coerce.number().int().min(0).optional(),
  avatar_url: z.string().optional(),
  aadhaar_photo_url: z.string().optional(),
  rent_amount: z.coerce.number().min(0).optional(),
  stay_type: z.enum(["monthly", "daily"]).default("monthly"),
  daily_rate: z.coerce.number().min(0).optional(),
  stay_days: z.coerce.number().int().min(1).optional(),
});

export async function addTenantAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const parsed = tenantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const admin = createAdminClient();

  const bedId = d.bed_id && d.bed_id !== "none" ? d.bed_id : null;
  let roomId: string | null = null;
  let rent = 0;
  if (bedId) {
    const { data: bed } = await admin.from("beds").select("*").eq("id", bedId).maybeSingle();
    if (!bed || bed.pg_id !== pid || bed.status !== "vacant") {
      return { error: "That bed is no longer available." };
    }
    roomId = bed.room_id;
    rent = bed.price_per_month;
  }

  // Day-wise stay: one total for the whole stay (daily rate * days) overrides the
  // bed's monthly price.
  let dailyRate: number | null = null;
  let stayDays: number | null = null;
  if (d.stay_type === "daily") {
    if (!d.daily_rate || !d.stay_days) return { error: "Enter the daily rate and number of days." };
    dailyRate = d.daily_rate;
    stayDays = d.stay_days;
    rent = Math.round(dailyRate * stayDays);
  } else if (d.rent_amount != null) {
    rent = d.rent_amount; // editable monthly rent (per-tenant discount) overrides the bed price
  }

  // Login is optional: only create an auth account when BOTH email + password
  // are given. Otherwise the tenant is a record with no portal login.
  let userId: string | null = null;
  const wantsLogin = !!(d.email && d.login_password);
  if (wantsLogin) {
    const { data: created, error: userErr } = await admin.auth.admin.createUser({
      email: d.email,
      password: d.login_password,
      email_confirm: true,
      user_metadata: { full_name: d.name },
    });
    if (userErr || !created.user) {
      const m = userErr?.message ?? "";
      const code = (userErr as { code?: string } | null)?.code ?? "";
      const exists = code === "email_exists" || /already|registered|exists|duplicate/i.test(m);
      return {
        error: exists
          ? "That email already has a login. Use a different email for this tenant."
          : m || "Could not create the tenant login.",
      };
    }
    userId = created.user.id;
  }

  // sequential registration number for editions that use one (e.g. GVM-0001)
  let regNo: string | null = null;
  const { regPrefix } = await getEdition();
  if (regPrefix) {
    const { data: n } = await admin.rpc("next_tenant_no", { p_pg: pid });
    if (typeof n === "number") regNo = `${regPrefix}-${String(n).padStart(4, "0")}`;
  }

  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .insert({
      pg_id: pid,
      room_id: roomId,
      bed_id: bedId,
      user_id: userId,
      name: d.name,
      phone: d.phone,
      parent_phone: d.parent_phone || null,
      father_name: d.father_name || null,
      mother_name: d.mother_name || null,
      address: d.address || null,
      occupation: d.occupation || null,
      organization: d.organization || null,
      email: d.email || null,
      reg_no: regNo,
      aadhaar_number: d.aadhaar_number || null,
      avatar_url: d.avatar_url || null,
      aadhaar_photo_url: d.aadhaar_photo_url || null,
      rent_amount: rent,
      security_deposit: d.security_deposit,
      checkin_date: d.checkin_date,
      rent_due_day: d.rent_due_day,
      stay_type: d.stay_type,
      daily_rate: dailyRate,
      stay_days: stayDays,
    })
    .select()
    .single();
  if (tErr || !tenant) {
    if (userId) await admin.auth.admin.deleteUser(userId);
    return { error: humanizeDbError(tErr, "Could not create the tenant.") };
  }

  if (userId) {
    await admin.from("profiles").upsert({
      id: userId,
      role: "tenant",
      pg_id: pid,
      full_name: d.name,
      phone: d.phone,
    });
  }

  // occupy the bed, log the timeline + activity, and record any joining fee —
  // all independent writes, run concurrently to keep the save snappy.
  await Promise.all([
    bedId
      ? admin.from("beds").update({ status: "occupied", current_tenant_id: tenant.id }).eq("id", bedId)
      : Promise.resolve(),
    logTenantEvent({
      pgId: pid,
      tenantId: tenant.id,
      type: "joined",
      detail: roomId ? "Checked in" : "Added (no bed yet)",
      roomId,
    }),
    logActivity("tenant.added", `Added tenant ${d.name}`),
    d.joining_fee && d.joining_fee > 0
      ? admin.from("joining_fees").insert({ pg_id: pid, tenant_id: tenant.id, amount: d.joining_fee })
      : Promise.resolve(),
  ]);

  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ---- lean record onboarding (custom editions: no login, ID capture) ------ */

const recordSchema = z.object({
  name: z.string().min(2, "Name is required."),
  phone: z.string().min(8, "Enter a valid phone."),
  aadhaar_number: z.string().optional(),
  aadhaar_photo_url: z.string().optional(),
  avatar_url: z.string().optional(), // live check-in photo of the tenant
  bed_id: z.string().optional(),
  security_deposit: z.coerce.number().min(0).optional(),
  checkin_date: z.string().min(1, "Check-in date is required."),
  stay_type: z.enum(["monthly", "daily"]).default("monthly"),
  daily_rate: z.coerce.number().min(0).optional(),
  stay_days: z.coerce.number().int().min(1).optional(),
});

/** Register a resident as a RECORD only — no tenant login is created. Captures
 *  ID + photo and assigns a sequential reg-no. Used by the GVR-style editions. */
export async function addTenantRecordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const parsed = recordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const cloud = /^https:\/\/res\.cloudinary\.com\//;
  // KYC is a private Cloudinary asset ("cld:<public_id>.<ext>"); also tolerate a
  // legacy Cloudinary URL or an old Supabase path.
  const kycPath = /^[\w-]+\/[\w-]+\.(png|jpe?g|webp)$/i;
  const kyc = d.aadhaar_photo_url;
  if (kyc && !kyc.startsWith("cld:") && !cloud.test(kyc) && !kycPath.test(kyc))
    return { error: "Invalid ID photo." };
  if (d.avatar_url && !cloud.test(d.avatar_url)) return { error: "Invalid tenant photo." };
  const admin = createAdminClient();

  const bedId = d.bed_id && d.bed_id !== "none" ? d.bed_id : null;
  let roomId: string | null = null;
  let rent = 0;
  if (bedId) {
    const { data: bed } = await admin.from("beds").select("*").eq("id", bedId).maybeSingle();
    if (!bed || bed.pg_id !== pid || bed.status !== "vacant") {
      return { error: "That bed is no longer available." };
    }
    roomId = bed.room_id;
    rent = bed.price_per_month;
  }

  let dailyRate: number | null = null;
  let stayDays: number | null = null;
  if (d.stay_type === "daily") {
    if (!d.daily_rate || !d.stay_days) return { error: "Enter the daily rate and number of days." };
    dailyRate = d.daily_rate;
    stayDays = d.stay_days;
    rent = Math.round(dailyRate * stayDays);
  }

  let regNo: string | null = null;
  const { regPrefix } = await getEdition();
  if (regPrefix) {
    const { data: n } = await admin.rpc("next_tenant_no", { p_pg: pid });
    if (typeof n === "number") regNo = `${regPrefix}-${String(n).padStart(4, "0")}`;
  }

  const { data: tenant, error } = await admin
    .from("tenants")
    .insert({
      pg_id: pid,
      room_id: roomId,
      bed_id: bedId,
      name: d.name,
      phone: d.phone,
      reg_no: regNo,
      aadhaar_number: d.aadhaar_number || null,
      aadhaar_photo_url: d.aadhaar_photo_url || null,
      avatar_url: d.avatar_url || null,
      rent_amount: rent,
      security_deposit: d.security_deposit ?? 0,
      checkin_date: d.checkin_date,
      stay_type: d.stay_type,
      daily_rate: dailyRate,
      stay_days: stayDays,
    })
    .select()
    .single();
  if (error || !tenant) return { error: humanizeDbError(error, "Could not save the record.") };

  await Promise.all([
    bedId
      ? admin.from("beds").update({ status: "occupied", current_tenant_id: tenant.id }).eq("id", bedId)
      : Promise.resolve(),
    logTenantEvent({
      pgId: pid,
      tenantId: tenant.id,
      type: "joined",
      detail: roomId ? "Checked in" : "Registered",
      roomId,
    }),
    logActivity("tenant.added", `Registered tenant ${d.name}`),
  ]);

  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Toggle a joining fee between paid / unpaid. */
export async function toggleJoiningFeePaidAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const paid = formData.get("paid") === "true";
  const s = await createClient();
  await s
    .from("joining_fees")
    .update({ paid, paid_date: paid ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", id);
  const tenantId = String(formData.get("tenant_id") || "");
  if (tenantId) revalidatePath(`/dashboard/tenants/${tenantId}`);
}

const tenantUpdateSchema = z.object({
  name: z.string().min(2, "Name is required."),
  phone: z.string().min(8, "Enter a valid phone."),
  parent_phone: z.string().optional(),
  father_name: z.string().optional(),
  mother_name: z.string().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  organization: z.string().optional(),
  email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  aadhaar_number: z.string().optional(),
  bed_id: z.string().optional(),
  security_deposit: z.coerce.number().min(0),
  checkin_date: z.string().optional(),
  rent_due_day: z.coerce.number().int().min(1).max(28),
  avatar_url: z.string().optional(),
  aadhaar_photo_url: z.string().optional(),
  rent_amount: z.coerce.number().min(0).optional(),
  stay_type: z.enum(["monthly", "daily"]).default("monthly"),
  daily_rate: z.coerce.number().min(0).optional(),
  stay_days: z.coerce.number().int().min(1).optional(),
});

export async function updateTenantAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["admin", "staff"]);
  if (!canEdit(me)) return { error: "You don't have permission to edit." };
  const id = String(formData.get("id"));
  const parsed = tenantUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const newBedId = d.bed_id && d.bed_id !== "none" ? d.bed_id : null;
  const s = await createClient();

  const { data: tenant } = await s
    .from("tenants")
    .select("bed_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!tenant) return { error: "Tenant not found." };

  let roomId: string | null = null;
  let rent = 0;
  if (newBedId) {
    const { data: bed } = await s.from("beds").select("*").eq("id", newBedId).maybeSingle();
    if (!bed || (bed.status !== "vacant" && bed.id !== tenant.bed_id)) {
      return { error: "That bed is no longer available." };
    }
    roomId = bed.room_id;
    rent = bed.price_per_month;
  }

  // Day-wise: total stay amount overrides the bed's monthly price.
  let dailyRate: number | null = null;
  let stayDays: number | null = null;
  if (d.stay_type === "daily") {
    if (!d.daily_rate || !d.stay_days) return { error: "Enter the daily rate and number of days." };
    dailyRate = d.daily_rate;
    stayDays = d.stay_days;
    rent = Math.round(dailyRate * stayDays);
  } else if (d.rent_amount != null) {
    rent = d.rent_amount; // editable monthly rent overrides the bed price
  }

  const { error } = await s
    .from("tenants")
    .update({
      name: d.name,
      phone: d.phone,
      parent_phone: d.parent_phone || null,
      father_name: d.father_name || null,
      mother_name: d.mother_name || null,
      address: d.address || null,
      occupation: d.occupation || null,
      organization: d.organization || null,
      email: d.email || null,
      aadhaar_number: d.aadhaar_number || null,
      ...(d.checkin_date ? { checkin_date: d.checkin_date } : {}),
      ...(d.avatar_url ? { avatar_url: d.avatar_url } : {}),
      ...(d.aadhaar_photo_url ? { aadhaar_photo_url: d.aadhaar_photo_url } : {}),
      bed_id: newBedId,
      room_id: roomId,
      rent_amount: rent,
      security_deposit: d.security_deposit,
      rent_due_day: d.rent_due_day,
      stay_type: d.stay_type,
      daily_rate: dailyRate,
      stay_days: stayDays,
    })
    .eq("id", id);
  if (error) return { error: humanizeDbError(error) };

  if (tenant.bed_id !== newBedId) {
    if (tenant.bed_id) {
      await s.from("beds").update({ status: "vacant", current_tenant_id: null }).eq("id", tenant.bed_id);
    }
    if (newBedId && tenant.status === "active") {
      await s.from("beds").update({ status: "occupied", current_tenant_id: id }).eq("id", newBedId);
    }
    const pid = await getActiveProperty();
    if (pid && newBedId) {
      await Promise.all([
        logTenantEvent({ pgId: pid, tenantId: id, type: "room_changed", detail: "Moved room", roomId }),
        notifyTenant(pid, id, "Your room / bed was updated by your PG owner.", "/portal"),
      ]);
    }
  }

  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${id}`);
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function checkoutTenantAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const s = await createClient();
  const { data: tenant } = await s
    .from("tenants")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!tenant || tenant.status === "checked_out") return;
  await s
    .from("tenants")
    .update({ status: "checked_out", checkout_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  // free their bed (trigger re-syncs the room's occupancy)
  await s.from("beds").update({ status: "vacant", current_tenant_id: null }).eq("current_tenant_id", id);
  const pid = await getActiveProperty();
  if (pid) {
    await Promise.all([
      logTenantEvent({ pgId: pid, tenantId: id, type: "checked_out", detail: "Checked out" }),
      notifyTenant(pid, id, "You've been checked out of the PG.", "/portal/bill"),
    ]);
  }
  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${id}`);
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
}

const settlementSchema = z.object({
  tenant_id: z.string().min(1),
  checkout_date: z.string().min(1, "Checkout date is required."),
  last_paid_until: z.string().optional(),
  notice_given_date: z.string().optional(),
  damages: z.coerce.number().int().min(0).optional(),
  advance_amount: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
});

/** Compute + persist a checkout settlement, then check the tenant out. The math
 *  is recomputed server-side (never trusts client numbers) from the property
 *  policy, the bed price, deposit and the dates provided. */
export async function saveSettlementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const parsed = settlementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const s = await createClient();

  const { data: tenant } = await s
    .from("tenants")
    .select("id, pg_id, rent_amount, security_deposit, lock_in_end_date, notice_given_date, status")
    .eq("id", d.tenant_id)
    .maybeSingle();
  if (!tenant) return { error: "That tenant is not in any of your properties." };
  const pid = tenant.pg_id as string;

  const { data: policy } = await s
    .from("pg_policies")
    .select("notice_period_days")
    .eq("pg_id", pid)
    .maybeSingle();

  const res = computeSettlement({
    pricePerMonth: tenant.rent_amount,
    checkoutISO: d.checkout_date,
    lastPaidUntilISO: d.last_paid_until || null,
    noticeGivenISO: d.notice_given_date || tenant.notice_given_date || null,
    noticePeriodDays: policy?.notice_period_days ?? 30,
    lockInEndISO: tenant.lock_in_end_date,
    depositAmount: tenant.security_deposit,
    damages: d.damages ?? 0,
    advanceAmount: d.advance_amount ?? 0,
  });

  // note the advance adjustment/refund so it's on the record
  const advanceNote =
    res.advanceAmount > 0
      ? res.amountDue > 0
        ? `₹${res.advanceAmount.toLocaleString("en-IN")} advance adjusted against dues.`
        : `₹${res.advanceAmount.toLocaleString("en-IN")} advance refunded.`
      : "";
  const settlementNotes = [d.notes?.trim(), advanceNote].filter(Boolean).join(" ") || null;

  const { error: insErr } = await s.from("checkout_settlements").insert({
    pg_id: pid,
    tenant_id: d.tenant_id,
    checkout_date: d.checkout_date,
    last_paid_until: d.last_paid_until || null,
    pro_rata_days_owed: res.proRataDaysOwed,
    pro_rata_amount: res.proRataAmount,
    notice_shortfall_days: res.noticeShortfallDays,
    notice_penalty: res.noticePenalty,
    lock_in_forfeiture: res.lockInForfeiture,
    damages_deduction: res.damages,
    deposit_amount: res.depositAmount,
    advance_amount: res.advanceAmount,
    refundable_amount: res.refundableAmount,
    notes: settlementNotes,
    status: "confirmed",
  });
  if (insErr) return { error: humanizeDbError(insErr) };

  // Check the tenant out + free their bed.
  if (tenant.status !== "checked_out") {
    await s
      .from("tenants")
      .update({
        status: "checked_out",
        checkout_date: d.checkout_date,
        notice_given_date: d.notice_given_date || tenant.notice_given_date || null,
      })
      .eq("id", d.tenant_id);
    await Promise.all([
      s.from("beds").update({ status: "vacant", current_tenant_id: null }).eq("current_tenant_id", d.tenant_id),
      logTenantEvent({
        pgId: pid,
        tenantId: d.tenant_id,
        type: "checked_out",
        detail: `Checked out · refund ₹${res.refundableAmount.toLocaleString("en-IN")}`,
      }),
      notifyTenant(
        pid,
        d.tenant_id,
        `You've been checked out. Indicative deposit refund: ₹${res.refundableAmount.toLocaleString("en-IN")}.`,
        "/portal/bill",
      ),
    ]);
  }

  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${d.tenant_id}`);
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteTenantAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "staff"]);
  if (!canDelete(me)) return;
  const id = String(formData.get("id"));
  const s = await createClient();
  const { data: tenant } = await s
    .from("tenants")
    .select("user_id, name")
    .eq("id", id)
    .maybeSingle();
  if (!tenant) return;
  await s.from("beds").update({ status: "vacant", current_tenant_id: null }).eq("current_tenant_id", id);
  await s.from("tenants").delete().eq("id", id); // cascades payments/issues/food_opt
  if (tenant.user_id) {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(tenant.user_id);
  }
  await logActivity("tenant.deleted", `Deleted tenant ${tenant.name ?? ""}`.trim());
  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
}

/* ---- tenant ID documents (Aadhaar / DL / passport / voter / other) ------- */

const docSchema = z.object({
  tenant_id: z.string().uuid(),
  doc_type: z.enum(["aadhaar", "dl", "passport", "voter", "other"]),
  file_url: z.string().regex(/^cld:/, "Upload a document first."),
  label: z.string().optional(),
});

export async function addTenantDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const parsed = docSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("tenant_documents").insert({
    pg_id: pid,
    tenant_id: d.tenant_id,
    doc_type: d.doc_type,
    file_url: d.file_url,
    label: d.label?.trim() || null,
  });
  if (error) return { error: humanizeDbError(error, "Could not save the document.") };
  revalidatePath(`/dashboard/tenants/${d.tenant_id}`);
  return { ok: true };
}

export async function deleteTenantDocumentAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "staff"]);
  if (!canDelete(me)) return;
  const pid = await getActiveProperty();
  const id = String(formData.get("id"));
  const tenantId = String(formData.get("tenant_id") || "");
  if (!pid || !id) return;
  const admin = createAdminClient();
  await admin.from("tenant_documents").delete().eq("id", id).eq("pg_id", pid);
  if (tenantId) revalidatePath(`/dashboard/tenants/${tenantId}`);
}

/* -------------------------------- payments ------------------------------- */

const paymentSchema = z.object({
  tenant_id: z.string().min(1),
  month_for: z.string().min(1),
  base_rent: z.coerce.number().min(0),
  electricity_charge: z.coerce.number().min(0),
  food_charge: z.coerce.number().min(0),
  other_charges: z.coerce.number().min(0),
  security_deposit: z.coerce.number().min(0).optional().default(0),
  joining_fee: z.coerce.number().min(0).optional().default(0),
  amount_paid: z.coerce.number().min(0),
  payment_mode: z.enum(["cash", "upi", "bank"]),
  payment_screenshot_url: z.string().optional(),
  notes: z.string().optional(),
});

export async function recordPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const s = await createClient();

  // Resolve the property from the tenant (RLS only returns tenants the caller
  // belongs to) and check any existing bill — in parallel (independent reads).
  const [{ data: tenant }, { data: existing }] = await Promise.all([
    s.from("tenants").select("id, pg_id").eq("id", d.tenant_id).maybeSingle(),
    s.from("payments").select("status").eq("tenant_id", d.tenant_id).eq("month_for", d.month_for).maybeSingle(),
  ]);
  if (!tenant) return { error: "That tenant is not in any of your properties." };
  const pid = tenant.pg_id as string;

  // Guard: don't silently overwrite a bill that's already fully paid.
  if (existing?.status === "paid") {
    return { error: `A paid bill already exists for ${d.month_for}. Open that month to edit it instead of replacing it.` };
  }

  const { error } = await s.from("payments").upsert(
    {
      pg_id: pid,
      tenant_id: d.tenant_id,
      month_for: d.month_for,
      base_rent: d.base_rent,
      electricity_charge: d.electricity_charge,
      food_charge: d.food_charge,
      other_charges: d.other_charges,
      security_deposit: d.security_deposit,
      joining_fee: d.joining_fee,
      amount_paid: d.amount_paid,
      payment_mode: d.payment_mode,
      payment_date: d.amount_paid > 0 ? new Date().toISOString().slice(0, 10) : null,
      verified: true, // admin-recorded payments are trusted
      // only set the screenshot when one was uploaded (don't wipe an existing proof)
      ...(d.payment_screenshot_url ? { payment_screenshot_url: d.payment_screenshot_url } : {}),
      notes: d.notes || null,
    },
    { onConflict: "tenant_id,month_for" },
  );
  if (error) return { error: humanizeDbError(error) };

  // best-effort side-effects run concurrently (none blocks the others)
  await Promise.all([
    notifyTenant(pid, d.tenant_id, `Your payment for ${d.month_for} was recorded.`, "/portal/bill"),
    logActivity("payment.recorded", `Recorded ₹${d.amount_paid.toLocaleString("en-IN")} for ${d.month_for}`),
    d.amount_paid > 0
      ? logTenantEvent({
          pgId: pid,
          tenantId: d.tenant_id,
          type: "payment",
          detail: `Paid ₹${d.amount_paid.toLocaleString("en-IN")} for ${d.month_for}`,
        })
      : Promise.resolve(),
  ]);
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ------------------------------ electricity ------------------------------ */

const electricitySchema = z.object({
  tenant_id: z.string().min(1),
  month_for: z.string().min(1),
  units: z.coerce.number().min(0, "Enter the units used."),
});

/** Record a tenant's electricity meter reading for the month. The charge is
 *  computed from the property policy (free units + per-unit rate) and added to
 *  that month's bill. */
export async function recordElectricityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const parsed = electricitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const s = await createClient();

  const { data: tenant } = await s
    .from("tenants")
    .select("pg_id, rent_amount, checkin_date, food_opt_out")
    .eq("id", d.tenant_id)
    .maybeSingle();
  if (!tenant) return { error: "That tenant is not in any of your properties." };
  const pid = tenant.pg_id as string;

  const [{ data: policy }, { data: pg }, { data: existing }] = await Promise.all([
    s.from("pg_policies").select("electricity_included_units, electricity_per_unit_rate").eq("pg_id", pid).maybeSingle(),
    s.from("pg_accounts").select("food_opt_out_deduction").eq("id", pid).maybeSingle(),
    s.from("payments").select("*").eq("tenant_id", d.tenant_id).eq("month_for", d.month_for).maybeSingle(),
  ]);

  const included = policy?.electricity_included_units ?? 0;
  const rate = policy?.electricity_per_unit_rate ?? 0;
  const charge = Math.max(0, Math.round((d.units - included) * rate));

  const derived = computeBill({
    pricePerMonth: tenant.rent_amount,
    checkinISO: tenant.checkin_date,
    month: d.month_for,
    foodOptOut: tenant.food_opt_out,
    foodOptOutDeduction: pg?.food_opt_out_deduction ?? 0,
  });

  const { error } = await s.from("payments").upsert(
    {
      pg_id: pid,
      tenant_id: d.tenant_id,
      month_for: d.month_for,
      base_rent: existing?.base_rent ?? derived.baseRent,
      electricity_charge: charge,
      food_charge: existing?.food_charge ?? 0,
      other_charges: existing?.other_charges ?? 0,
      food_opt_out_deduction: existing?.food_opt_out_deduction ?? derived.foodDeduction,
      amount_paid: existing?.amount_paid ?? 0,
      payment_mode: existing?.payment_mode ?? null,
      verified: existing?.verified ?? false,
      is_pro_rata: existing?.is_pro_rata ?? derived.isProRata,
      pro_rata_days: existing?.pro_rata_days ?? (derived.isProRata ? derived.proRataDays : null),
    },
    { onConflict: "tenant_id,month_for" },
  );
  if (error) return { error: humanizeDbError(error) };

  await notifyTenant(pid, d.tenant_id, `Electricity for ${d.month_for}: ₹${charge.toLocaleString("en-IN")} added to your bill.`, "/portal/bill");
  revalidatePath("/dashboard/payments");
  revalidatePath(`/dashboard/tenants/${d.tenant_id}`);
  revalidatePath("/portal/bill");
  return { ok: true };
}

/* -------------------------------- expenses ------------------------------- */

/** Built-in categories every property starts with (lowercase, kept in sync
 *  with DEFAULT_CATEGORIES in the add-expense dialog). */
const DEFAULT_EXPENSE_CATEGORIES = [
  "rent",
  "salaries",
  "utilities",
  "groceries",
  "maintenance",
  "supplies",
  "marketing",
  "other",
];

const expenseSchema = z.object({
  category: z.string().trim().min(1, "Pick a category.").max(40),
  subcategory: z.string().trim().max(40).optional(),
  amount: z.coerce.number().min(0, "Enter an amount."),
  date: z.string().min(1, "Date is required."),
  description: z.string().optional(),
});

export async function addExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const sub = parsed.data.subcategory?.trim() || null;
  const s = await createClient();
  const { error } = await s.from("expenses").insert({
    pg_id: pid,
    category: parsed.data.category,
    subcategory: sub,
    amount: parsed.data.amount,
    date: parsed.data.date,
    description: parsed.data.description || null,
    added_by: me.id,
  });
  if (error) return { error: humanizeDbError(error) };
  // remember any newly-typed category / sub-category + log activity — all
  // independent of each other, so run them concurrently to keep the save fast.
  await Promise.all([
    DEFAULT_EXPENSE_CATEGORIES.includes(parsed.data.category.toLowerCase())
      ? Promise.resolve()
      : s.from("expense_categories").upsert({ pg_id: pid, name: parsed.data.category, parent: "" }, { onConflict: "pg_id,parent,name" }),
    sub
      ? s.from("expense_categories").upsert({ pg_id: pid, name: sub, parent: parsed.data.category }, { onConflict: "pg_id,parent,name" })
      : Promise.resolve(),
    logActivity("expense.added", `Added expense ₹${parsed.data.amount.toLocaleString("en-IN")} · ${parsed.data.category}${sub ? ` / ${sub}` : ""}`),
  ]);
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}

/** Add a custom expense category (top-level) or a sub-category under `parent`. */
export async function addExpenseCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const name = String(formData.get("name") ?? "").trim();
  const parent = String(formData.get("parent") ?? "").trim();
  if (!name) return { error: parent ? "Enter a sub-category name." : "Enter a category name." };
  if (name.length > 40) return { error: "Keep the name short." };
  const s = await createClient();
  const { error } = await s
    .from("expense_categories")
    .insert({ pg_id: pid, name, parent });
  if (error) {
    if (error.code === "23505") return { error: `That ${parent ? "sub-category" : "category"} already exists.` };
    return { error: humanizeDbError(error) };
  }
  await logActivity(
    "expense.category_added",
    parent ? `Added sub-category "${name}" under "${parent}"` : `Added expense category "${name}"`,
  );
  revalidatePath("/dashboard/expenses");
  return { ok: true };
}

/** Remove a custom category (and its sub-categories) or a single sub-category.
 *  Existing expenses keep their labels. */
export async function deleteExpenseCategoryAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return;
  const name = String(formData.get("name"));
  const parent = String(formData.get("parent") ?? "").trim();
  const s = await createClient();
  await s.from("expense_categories").delete().eq("pg_id", pid).eq("name", name).eq("parent", parent);
  // deleting a top-level category also removes its sub-categories
  if (!parent) {
    await s.from("expense_categories").delete().eq("pg_id", pid).eq("parent", name);
  }
  revalidatePath("/dashboard/expenses");
}

/** Owner confirms a tenant-submitted payment. */
export async function verifyPaymentAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const s = await createClient();
  const { data: p } = await s
    .from("payments")
    .select("pg_id, tenant_id, month_for")
    .eq("id", id)
    .maybeSingle();
  await s.from("payments").update({ verified: true }).eq("id", id);
  if (p) {
    await Promise.all([
      notifyTenant(
        p.pg_id as string,
        p.tenant_id as string,
        `Your payment for ${p.month_for} was confirmed ✓`,
        "/portal/bill",
      ),
      logActivity("payment.verified", `Verified payment for ${p.month_for}`),
    ]);
  }
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard");
  revalidatePath("/portal/bill");
}

/** Owner rejects a tenant-submitted payment: clears the claimed amount + proof
 *  so the bill returns to unpaid and the tenant can re-submit. */
export async function rejectPaymentAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const s = await createClient();
  const { data: p } = await s
    .from("payments")
    .select("pg_id, tenant_id, month_for")
    .eq("id", id)
    .maybeSingle();
  await s
    .from("payments")
    .update({
      amount_paid: 0,
      verified: false,
      payment_mode: null,
      payment_date: null,
      payment_screenshot_url: null,
    })
    .eq("id", id);
  if (p) {
    await notifyTenant(
      p.pg_id as string,
      p.tenant_id as string,
      `Your payment for ${p.month_for} couldn't be confirmed — please re-submit.`,
      "/portal/bill",
    );
  }
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard");
  revalidatePath("/portal/bill");
}

/** Nudge a tenant about a pending bill via an in-app notification. (Groundwork
 *  for WhatsApp reminders later — same trigger, different channel.) */
export async function remindTenantAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return;
  const tenantId = String(formData.get("tenant_id"));
  const month = String(formData.get("month") || "");
  const balance = Number(formData.get("balance") || 0);
  const s = await createClient();
  const { data: t } = await s.from("tenants").select("id, pg_id").eq("id", tenantId).maybeSingle();
  if (!t || t.pg_id !== pid) return;
  const amt = balance > 0 ? `₹${balance.toLocaleString("en-IN")} ` : "";
  await notifyTenant(
    pid,
    tenantId,
    `Rent reminder: ${amt}is pending${month ? ` for ${month}` : ""}. Please pay at your earliest.`,
    "/portal/bill",
  );
  revalidatePath("/dashboard/payments");
}

const expenseUpdateSchema = expenseSchema; // same shape

export async function updateExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["admin", "staff"]);
  if (!canEdit(me)) return { error: "You don't have permission to edit." };
  const id = String(formData.get("id"));
  const parsed = expenseUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const s = await createClient();
  const { error } = await s
    .from("expenses")
    .update({
      category: parsed.data.category,
      subcategory: parsed.data.subcategory?.trim() || null,
      amount: parsed.data.amount,
      date: parsed.data.date,
      description: parsed.data.description || null,
    })
    .eq("id", id);
  if (error) return { error: humanizeDbError(error) };
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "staff"]);
  if (!canDelete(me)) return;
  const id = String(formData.get("id"));
  const s = await createClient();
  await s.from("expenses").delete().eq("id", id);
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
}

const issueEditSchema = z.object({
  category: z.enum(["electricity", "plumbing", "wifi", "cleaning", "noise", "other"]),
  description: z.string().min(5, "Describe the issue (5+ characters)."),
});

export async function updateIssueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["admin", "staff"]);
  if (!canEdit(me)) return { error: "You don't have permission to edit." };
  const id = String(formData.get("id"));
  const parsed = issueEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const s = await createClient();
  const { error } = await s
    .from("issues")
    .update({ category: parsed.data.category, description: parsed.data.description })
    .eq("id", id);
  if (error) return { error: humanizeDbError(error) };
  revalidatePath("/dashboard/issues");
  return { ok: true };
}

export async function deleteIssueAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "staff"]);
  if (!canDelete(me)) return;
  const id = String(formData.get("id"));
  const s = await createClient();
  await s.from("issues").delete().eq("id", id);
  revalidatePath("/dashboard/issues");
  revalidatePath("/dashboard");
}

/* --------------------------------- issues -------------------------------- */

export async function setIssueStatusAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["open", "in_progress", "resolved"].includes(status)) return;
  const s = await createClient();
  const { data: issue } = await s
    .from("issues")
    .select("tenant_id, pg_id")
    .eq("id", id)
    .maybeSingle();
  await s
    .from("issues")
    .update({
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (status === "resolved" && issue) {
    await notifyTenant(
      issue.pg_id as string,
      issue.tenant_id as string,
      "Your complaint was resolved ✓",
      "/portal/issues",
    );
  }
  revalidatePath("/dashboard/issues");
  revalidatePath("/dashboard");
}
