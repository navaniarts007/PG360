"use server";

import { revalidatePath } from "next/cache";
import { humanizeDbError } from "../errors";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole } from "../guards";
import { canDelete, canEdit } from "../perms";
import { logActivity } from "../activity";
import { getActiveProperty } from "../auth";
import { query, queryOne, withTransaction, type Tx } from "../mysql/client";
import { notifyTenant } from "../notify";
import { computeBill, computeSettlement } from "../money";
import { getEdition } from "../get-client";
import { VPS_MARKER } from "../storage/vps";
import { logTenantEvent } from "../events";

export type ActionState = { ok?: boolean; error?: string };

const amenityList = (s?: string) => (s ?? "").split(",").map((a) => a.trim()).filter(Boolean);

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
  pid: string,
  wifiNetworkId: string | undefined,
): Promise<{ wifi_password: string; wifi_ssid: string | null; wifi_network_id: string | null }> {
  if (wifiNetworkId && wifiNetworkId !== "none") {
    const w = await queryOne<{ id: string; pg_id: string; password: string; ssid: string }>(
      `select id, pg_id, password, ssid from wifi_networks where id = ?`,
      [wifiNetworkId],
    );
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

  const rc = await queryOne<{ id: string; pg_id: string; room_type: string; price_per_month: number }>(
    `select id, pg_id, room_type, price_per_month from rate_cards where id = ?`,
    [d.rate_card_id],
  );
  if (!rc || rc.pg_id !== pid) return { error: "That rate card isn't in this property." };

  const floor = await queryOne<{ sort_order: number }>(`select sort_order from floors where id = ?`, [
    d.floor_id,
  ]);
  const wifi = await resolveWifi(pid, d.wifi_network_id);
  const roomId = randomUUID();

  try {
    await withTransaction(async (tx) => {
      await tx.query(
        `insert into rooms
           (id, pg_id, room_number, floor, floor_id, type, total_beds, occupied_beds, rent_amount,
            wifi_password, wifi_ssid, wifi_network_id, amenities)
         values (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
        [
          roomId,
          pid,
          d.room_number,
          floor?.sort_order ?? 0,
          d.floor_id,
          rc.room_type,
          d.total_beds,
          rc.price_per_month,
          wifi.wifi_password,
          wifi.wifi_ssid,
          wifi.wifi_network_id,
          JSON.stringify(amenityList(d.amenities)),
        ],
      );
      const bedRows = Array.from({ length: d.total_beds }, (_, i) => [
        pid,
        roomId,
        `${d.room_number}-${i + 1}`,
        rc.id,
        rc.price_per_month,
      ]);
      const placeholders = bedRows.map(() => "(?,?,?,?,?)").join(",");
      await tx.query(
        `insert into beds (pg_id, room_id, bed_number, rate_card_id, price_per_month) values ${placeholders}`,
        bedRows.flat(),
      );
    });
  } catch (error) {
    return { error: humanizeDbError(error as never, "Could not create the room.") };
  }

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
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const id = String(formData.get("id"));
  const parsed = roomUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  // pg_id = ? fixes a cross-tenant write gap the original had (id-only).
  const room = await queryOne<{ id: string; pg_id: string; rent_amount: number }>(
    `select id, pg_id, rent_amount from rooms where id = ? and pg_id = ?`,
    [id, pid],
  );
  if (!room) return { error: "Room not found." };

  const current = await query<{ id: string; status: string; bed_number: string }>(
    `select id, status, bed_number from beds where room_id = ? order by bed_number`,
    [id],
  );
  const occupied = current.filter((b) => b.status === "occupied").length;
  if (d.total_beds < occupied) {
    return { error: `Can't reduce below ${occupied} occupied bed(s).` };
  }

  const floor = await queryOne<{ sort_order: number }>(`select sort_order from floors where id = ?`, [
    d.floor_id,
  ]);
  const wifi = await resolveWifi(pid, d.wifi_network_id);

  let roomType: string | null = null;
  let rentAmount: number | null = null;
  let rcPrice: number | null = null;
  if (d.rate_card_id) {
    const rc = await queryOne<{ id: string; room_type: string; price_per_month: number }>(
      `select id, room_type, price_per_month from rate_cards where id = ?`,
      [d.rate_card_id],
    );
    if (rc) {
      roomType = rc.room_type;
      rentAmount = rc.price_per_month;
      rcPrice = rc.price_per_month;
      await query(`update beds set rate_card_id = ?, price_per_month = ? where room_id = ?`, [
        rc.id,
        rc.price_per_month,
        id,
      ]);
    }
  }

  try {
    if (roomType) {
      await query(
        `update rooms set room_number = ?, floor_id = ?, floor = ?, total_beds = ?, wifi_password = ?,
                wifi_ssid = ?, wifi_network_id = ?, amenities = ?, type = ?, rent_amount = ?
          where id = ? and pg_id = ?`,
        [
          d.room_number,
          d.floor_id,
          floor?.sort_order ?? 0,
          d.total_beds,
          wifi.wifi_password,
          wifi.wifi_ssid,
          wifi.wifi_network_id,
          JSON.stringify(amenityList(d.amenities)),
          roomType,
          rentAmount,
          id,
          pid,
        ],
      );
    } else {
      await query(
        `update rooms set room_number = ?, floor_id = ?, floor = ?, total_beds = ?, wifi_password = ?,
                wifi_ssid = ?, wifi_network_id = ?, amenities = ?
          where id = ? and pg_id = ?`,
        [
          d.room_number,
          d.floor_id,
          floor?.sort_order ?? 0,
          d.total_beds,
          wifi.wifi_password,
          wifi.wifi_ssid,
          wifi.wifi_network_id,
          JSON.stringify(amenityList(d.amenities)),
          id,
          pid,
        ],
      );
    }
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }

  // grow / shrink beds to match total_beds (only vacant beds are removable)
  if (d.total_beds > current.length) {
    const add = Array.from({ length: d.total_beds - current.length }, (_, i) => [
      pid,
      id,
      `${d.room_number}-${current.length + i + 1}`,
      rcPrice ?? room.rent_amount,
    ]);
    const placeholders = add.map(() => "(?,?,?,?)").join(",");
    await query(
      `insert into beds (pg_id, room_id, bed_number, price_per_month) values ${placeholders}`,
      add.flat(),
    );
  } else if (d.total_beds < current.length) {
    const removable = current.filter((b) => b.status === "vacant").slice(0, current.length - d.total_beds).map((b) => b.id);
    if (removable.length) {
      await query(`delete from beds where id in (${removable.map(() => "?").join(",")})`, removable);
    }
  }

  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteRoomAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "staff"]);
  if (!canDelete(me)) return;
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  const row = await queryOne<{ n: number }>(
    `select count(*) as n from beds where room_id = ? and status = 'occupied'`,
    [id],
  );
  if ((row?.n ?? 0) > 0) return; // block delete while any bed is occupied
  await query(`delete from rooms where id = ? and pg_id = ?`, [id, pid]); // beds cascade
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
}

/* -------------------------------- tenants -------------------------------- */
// A tenant occupies a BED; rent derives from the bed's price.

/** Atomically claims the next sequential registration number for a property
 *  (e.g. GVM-0001). Mirrors the MySQL stored-procedure logic in
 *  deploy/.../mysql/004_counters_and_functions.sql inline, run on the same
 *  transaction connection as the tenant insert it's used for, rather than
 *  via CALL (session-variable OUT params don't survive across the pool's
 *  per-call connection borrowing). */
async function nextTenantNo(tx: Tx, pgId: string): Promise<number> {
  await tx.query(`insert into tenant_counters (pg_id, next_no) values (?, 1)
    on duplicate key update next_no = last_insert_id(next_no + 1)`, [pgId]);
  const row = await tx.queryOne<{ n: number; affected: number }>(`select last_insert_id() as n, row_count() as affected`);
  if (row?.affected === 1) return 1;
  return row?.n ?? 1;
}

const tenantSchema = z.object({
  name: z.string().min(2, "Name is required."),
  phone: z.string().min(8, "Enter a valid phone."),
  parent_phone: z.string().optional(),
  guardian: z.string().optional(),
  vehicle_number: z.string().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  organization: z.string().optional(),
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

  const bedId = d.bed_id && d.bed_id !== "none" ? d.bed_id : null;
  let roomId: string | null = null;
  let rent = 0;
  if (bedId) {
    const bed = await queryOne<{ id: string; pg_id: string; room_id: string; status: string; price_per_month: number }>(
      `select id, pg_id, room_id, status, price_per_month from beds where id = ?`,
      [bedId],
    );
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
  } else if (d.rent_amount != null) {
    rent = d.rent_amount;
  }

  const wantsLogin = !!(d.email && d.login_password);
  const email = wantsLogin ? d.email!.trim().toLowerCase() : null;
  if (wantsLogin) {
    const existing = await queryOne<{ id: string }>(`select id from users where email = ?`, [email]);
    if (existing) return { error: "That email already has a login. Use a different email for this tenant." };
  }

  const { regPrefix } = await getEdition();
  const passwordHash = wantsLogin ? await bcrypt.hash(d.login_password!, 10) : null;
  const userId = wantsLogin ? randomUUID() : null;
  const tenantId = randomUUID();

  try {
    await withTransaction(async (tx) => {
      if (userId) {
        await tx.query(`insert into users (id, email, password_hash) values (?, ?, ?)`, [
          userId,
          email,
          passwordHash,
        ]);
      }

      let regNo: string | null = null;
      if (regPrefix) {
        const n = await nextTenantNo(tx, pid);
        regNo = `${regPrefix}-${String(n).padStart(4, "0")}`;
      }

      await tx.query(
        `insert into tenants
           (id, pg_id, room_id, bed_id, user_id, name, phone, parent_phone, guardian, vehicle_number,
            address, occupation, organization, email, reg_no, aadhaar_number, avatar_url,
            aadhaar_photo_url, rent_amount, security_deposit, checkin_date, rent_due_day, stay_type,
            daily_rate, stay_days)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId, pid, roomId, bedId, userId, d.name, d.phone, d.parent_phone || null,
          d.guardian || null, d.vehicle_number || null, d.address || null, d.occupation || null,
          d.organization || null, d.email || null, regNo, d.aadhaar_number || null,
          d.avatar_url || null, d.aadhaar_photo_url || null, rent, d.security_deposit,
          d.checkin_date, d.rent_due_day, d.stay_type, dailyRate, stayDays,
        ],
      );

      if (userId) {
        await tx.query(`insert into profiles (id, role, pg_id, full_name, phone) values (?, 'tenant', ?, ?, ?)`, [
          userId,
          pid,
          d.name,
          d.phone,
        ]);
      }
      if (bedId) {
        await tx.query(`update beds set status = 'occupied', current_tenant_id = ? where id = ?`, [
          tenantId,
          bedId,
        ]);
      }
      if (d.joining_fee && d.joining_fee > 0) {
        await tx.query(`insert into joining_fees (pg_id, tenant_id, amount) values (?, ?, ?)`, [
          pid,
          tenantId,
          d.joining_fee,
        ]);
      }
    });
  } catch (error) {
    return { error: humanizeDbError(error as never, "Could not create the tenant.") };
  }

  await Promise.all([
    logTenantEvent({
      pgId: pid,
      tenantId,
      type: "joined",
      detail: roomId ? "Checked in" : "Added (no bed yet)",
      roomId,
    }),
    logActivity("tenant.added", `Added tenant ${d.name}`),
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
  avatar_url: z.string().optional(),
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
  if (d.aadhaar_photo_url && !VPS_MARKER.test(d.aadhaar_photo_url)) return { error: "Invalid ID photo." };
  if (d.avatar_url && !VPS_MARKER.test(d.avatar_url)) return { error: "Invalid tenant photo." };

  const bedId = d.bed_id && d.bed_id !== "none" ? d.bed_id : null;
  let roomId: string | null = null;
  let rent = 0;
  if (bedId) {
    const bed = await queryOne<{ id: string; pg_id: string; room_id: string; status: string; price_per_month: number }>(
      `select id, pg_id, room_id, status, price_per_month from beds where id = ?`,
      [bedId],
    );
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

  const { regPrefix } = await getEdition();
  const tenantId = randomUUID();

  try {
    await withTransaction(async (tx) => {
      let regNo: string | null = null;
      if (regPrefix) {
        const n = await nextTenantNo(tx, pid);
        regNo = `${regPrefix}-${String(n).padStart(4, "0")}`;
      }
      await tx.query(
        `insert into tenants
           (id, pg_id, room_id, bed_id, name, phone, reg_no, aadhaar_number, aadhaar_photo_url,
            avatar_url, rent_amount, security_deposit, checkin_date, stay_type, daily_rate, stay_days)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId, pid, roomId, bedId, d.name, d.phone, regNo, d.aadhaar_number || null,
          d.aadhaar_photo_url || null, d.avatar_url || null, rent, d.security_deposit ?? 0,
          d.checkin_date, d.stay_type, dailyRate, stayDays,
        ],
      );
      if (bedId) {
        await tx.query(`update beds set status = 'occupied', current_tenant_id = ? where id = ?`, [
          tenantId,
          bedId,
        ]);
      }
    });
  } catch (error) {
    return { error: humanizeDbError(error as never, "Could not save the record.") };
  }

  await Promise.all([
    logTenantEvent({
      pgId: pid,
      tenantId,
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
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  const paid = formData.get("paid") === "true";
  await query(`update joining_fees set paid = ?, paid_date = ? where id = ? and pg_id = ?`, [
    paid,
    paid ? new Date().toISOString().slice(0, 10) : null,
    id,
    pid,
  ]);
  const tenantId = String(formData.get("tenant_id") || "");
  if (tenantId) revalidatePath(`/dashboard/tenants/${tenantId}`);
}

const tenantUpdateSchema = z.object({
  name: z.string().min(2, "Name is required."),
  phone: z.string().min(8, "Enter a valid phone."),
  parent_phone: z.string().optional(),
  guardian: z.string().optional(),
  vehicle_number: z.string().optional(),
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
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const id = String(formData.get("id"));
  const parsed = tenantUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const newBedId = d.bed_id && d.bed_id !== "none" ? d.bed_id : null;

  // pg_id = ? fixes a cross-tenant write gap the original had (id-only).
  const tenant = await queryOne<{ bed_id: string | null; status: string }>(
    `select bed_id, status from tenants where id = ? and pg_id = ?`,
    [id, pid],
  );
  if (!tenant) return { error: "Tenant not found." };

  let roomId: string | null = null;
  let rent = 0;
  if (newBedId) {
    const bed = await queryOne<{ id: string; room_id: string; status: string; price_per_month: number }>(
      `select id, room_id, status, price_per_month from beds where id = ? and pg_id = ?`,
      [newBedId, pid],
    );
    if (!bed || (bed.status !== "vacant" && bed.id !== tenant.bed_id)) {
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
  } else if (d.rent_amount != null) {
    rent = d.rent_amount;
  }

  try {
    await query(
      `update tenants set
         name = ?, phone = ?, parent_phone = ?, guardian = ?, vehicle_number = ?, address = ?,
         occupation = ?, organization = ?, email = ?, aadhaar_number = ?,
         checkin_date = coalesce(?, checkin_date),
         avatar_url = coalesce(?, avatar_url),
         aadhaar_photo_url = coalesce(?, aadhaar_photo_url),
         bed_id = ?, room_id = ?, rent_amount = ?, security_deposit = ?, rent_due_day = ?,
         stay_type = ?, daily_rate = ?, stay_days = ?
       where id = ? and pg_id = ?`,
      [
        d.name, d.phone, d.parent_phone || null, d.guardian || null, d.vehicle_number || null,
        d.address || null, d.occupation || null, d.organization || null, d.email || null,
        d.aadhaar_number || null, d.checkin_date || null, d.avatar_url || null,
        d.aadhaar_photo_url || null, newBedId, roomId, rent, d.security_deposit, d.rent_due_day,
        d.stay_type, dailyRate, stayDays, id, pid,
      ],
    );
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }

  if (tenant.bed_id !== newBedId) {
    if (tenant.bed_id) {
      await query(`update beds set status = 'vacant', current_tenant_id = null where id = ?`, [tenant.bed_id]);
    }
    if (newBedId && tenant.status === "active") {
      await query(`update beds set status = 'occupied', current_tenant_id = ? where id = ?`, [id, newBedId]);
    }
    if (newBedId) {
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
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  const tenant = await queryOne<{ id: string; status: string }>(
    `select id, status from tenants where id = ? and pg_id = ?`,
    [id, pid],
  );
  if (!tenant || tenant.status === "checked_out") return;
  await query(`update tenants set status = 'checked_out', checkout_date = ? where id = ?`, [
    new Date().toISOString().slice(0, 10),
    id,
  ]);
  // free their bed (trigger re-syncs the room's occupancy)
  await query(`update beds set status = 'vacant', current_tenant_id = null where current_tenant_id = ?`, [id]);
  await Promise.all([
    logTenantEvent({ pgId: pid, tenantId: id, type: "checked_out", detail: "Checked out" }),
    notifyTenant(pid, id, "You've been checked out of the PG.", "/portal/bill"),
  ]);
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
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const parsed = settlementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  // pg_id = ? here (not resolved FROM the row) fixes a cross-tenant write gap.
  const tenant = await queryOne<{
    id: string;
    pg_id: string;
    rent_amount: number;
    security_deposit: number;
    lock_in_end_date: string | null;
    notice_given_date: string | null;
    status: string;
  }>(
    `select id, pg_id, rent_amount, security_deposit, lock_in_end_date, notice_given_date, status
       from tenants where id = ? and pg_id = ?`,
    [d.tenant_id, pid],
  );
  if (!tenant) return { error: "That tenant is not in any of your properties." };

  const policy = await queryOne<{ notice_period_days: number }>(
    `select notice_period_days from pg_policies where pg_id = ?`,
    [pid],
  );

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

  const advanceNote =
    res.advanceAmount > 0
      ? res.amountDue > 0
        ? `₹${res.advanceAmount.toLocaleString("en-IN")} advance adjusted against dues.`
        : `₹${res.advanceAmount.toLocaleString("en-IN")} advance refunded.`
      : "";
  const settlementNotes = [d.notes?.trim(), advanceNote].filter(Boolean).join(" ") || null;

  try {
    await query(
      `insert into checkout_settlements
         (pg_id, tenant_id, checkout_date, last_paid_until, pro_rata_days_owed, pro_rata_amount,
          notice_shortfall_days, notice_penalty, lock_in_forfeiture, damages_deduction, deposit_amount,
          advance_amount, refundable_amount, notes, status)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
      [
        pid, d.tenant_id, d.checkout_date, d.last_paid_until || null, res.proRataDaysOwed,
        res.proRataAmount, res.noticeShortfallDays, res.noticePenalty, res.lockInForfeiture,
        res.damages, res.depositAmount, res.advanceAmount, res.refundableAmount, settlementNotes,
      ],
    );
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }

  if (tenant.status !== "checked_out") {
    await query(`update tenants set status = 'checked_out', checkout_date = ?, notice_given_date = ? where id = ?`, [
      d.checkout_date,
      d.notice_given_date || tenant.notice_given_date || null,
      d.tenant_id,
    ]);
    await Promise.all([
      query(`update beds set status = 'vacant', current_tenant_id = null where current_tenant_id = ?`, [d.tenant_id]),
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
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  const tenant = await queryOne<{ user_id: string | null; name: string }>(
    `select user_id, name from tenants where id = ? and pg_id = ?`,
    [id, pid],
  );
  if (!tenant) return;
  await query(`update beds set status = 'vacant', current_tenant_id = null where current_tenant_id = ?`, [id]);
  await query(`delete from tenants where id = ?`, [id]); // cascades payments/issues/food_opt
  if (tenant.user_id) {
    await query(`delete from users where id = ?`, [tenant.user_id]).catch(() => {});
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
  file_url: z.string().regex(VPS_MARKER, "Upload a document first."),
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

  // the tenant must belong to the caller's active property
  const tenant = await queryOne<{ id: string }>(`select id from tenants where id = ? and pg_id = ?`, [
    d.tenant_id,
    pid,
  ]);
  if (!tenant) return { error: "Tenant not found." };

  try {
    await query(`insert into tenant_documents (pg_id, tenant_id, doc_type, file_url, label) values (?, ?, ?, ?, ?)`, [
      pid,
      d.tenant_id,
      d.doc_type,
      d.file_url,
      d.label?.trim() || null,
    ]);
  } catch (error) {
    return { error: humanizeDbError(error as never, "Could not save the document.") };
  }
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
  await query(`delete from tenant_documents where id = ? and pg_id = ?`, [id, pid]);
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
  payment_date: z.string().optional(),
  payment_screenshot_url: z.string().optional(),
  notes: z.string().optional(),
});

export type RecordPaymentState = ActionState & { paymentId?: string };

export async function recordPaymentAction(
  _prev: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  // pg_id = ? here (not resolved FROM the row) fixes a real cross-tenant
  // write gap the original had: it read the tenant's own pg_id and trusted
  // it as the target property, relying entirely on RLS to have already
  // restricted which tenants the caller could see in the first place.
  const [tenant, existing] = await Promise.all([
    queryOne<{ id: string; pg_id: string }>(`select id, pg_id from tenants where id = ? and pg_id = ?`, [
      d.tenant_id,
      pid,
    ]),
    queryOne<{ status: string }>(`select status from payments where tenant_id = ? and month_for = ?`, [
      d.tenant_id,
      d.month_for,
    ]),
  ]);
  if (!tenant) return { error: "That tenant is not in any of your properties." };

  if (existing?.status === "paid") {
    return {
      error: `A paid bill already exists for ${d.month_for}. Open that month to edit it instead of replacing it.`,
    };
  }

  try {
    if (d.payment_screenshot_url) {
      await query(
        `insert into payments
           (pg_id, tenant_id, month_for, base_rent, electricity_charge, food_charge, other_charges,
            security_deposit, joining_fee, amount_paid, payment_mode, payment_date, verified,
            payment_screenshot_url, notes)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?, ?)
         on duplicate key update
           base_rent = values(base_rent), electricity_charge = values(electricity_charge),
           food_charge = values(food_charge), other_charges = values(other_charges),
           security_deposit = values(security_deposit), joining_fee = values(joining_fee),
           amount_paid = values(amount_paid), payment_mode = values(payment_mode),
           payment_date = values(payment_date), verified = true,
           payment_screenshot_url = values(payment_screenshot_url), notes = values(notes)`,
        [
          pid, d.tenant_id, d.month_for, d.base_rent, d.electricity_charge, d.food_charge,
          d.other_charges, d.security_deposit, d.joining_fee, d.amount_paid, d.payment_mode,
          d.amount_paid > 0 ? d.payment_date || new Date().toISOString().slice(0, 10) : null,
          d.payment_screenshot_url, d.notes || null,
        ],
      );
    } else {
      // don't overwrite an existing screenshot when none was uploaded this time
      await query(
        `insert into payments
           (pg_id, tenant_id, month_for, base_rent, electricity_charge, food_charge, other_charges,
            security_deposit, joining_fee, amount_paid, payment_mode, payment_date, verified, notes)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?)
         on duplicate key update
           base_rent = values(base_rent), electricity_charge = values(electricity_charge),
           food_charge = values(food_charge), other_charges = values(other_charges),
           security_deposit = values(security_deposit), joining_fee = values(joining_fee),
           amount_paid = values(amount_paid), payment_mode = values(payment_mode),
           payment_date = values(payment_date), verified = true, notes = values(notes)`,
        [
          pid, d.tenant_id, d.month_for, d.base_rent, d.electricity_charge, d.food_charge,
          d.other_charges, d.security_deposit, d.joining_fee, d.amount_paid, d.payment_mode,
          d.amount_paid > 0 ? d.payment_date || new Date().toISOString().slice(0, 10) : null,
          d.notes || null,
        ],
      );
    }
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }

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
  // for the "print receipt right after saving" prompt — only offered when
  // something was actually collected (nothing to receipt for a ₹0 record).
  const saved =
    d.amount_paid > 0
      ? await queryOne<{ id: string }>(`select id from payments where tenant_id = ? and month_for = ?`, [
          d.tenant_id,
          d.month_for,
        ])
      : null;
  return { ok: true, paymentId: saved?.id };
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
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const parsed = electricitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  const tenant = await queryOne<{ pg_id: string; rent_amount: number; checkin_date: string; food_opt_out: boolean }>(
    `select pg_id, rent_amount, checkin_date, food_opt_out from tenants where id = ? and pg_id = ?`,
    [d.tenant_id, pid],
  );
  if (!tenant) return { error: "That tenant is not in any of your properties." };

  const [policy, pg, existing] = await Promise.all([
    queryOne<{ electricity_included_units: number; electricity_per_unit_rate: number }>(
      `select electricity_included_units, electricity_per_unit_rate from pg_policies where pg_id = ?`,
      [pid],
    ),
    queryOne<{ food_opt_out_deduction: number }>(`select food_opt_out_deduction from pg_accounts where id = ?`, [pid]),
    queryOne<Payment_>(`select * from payments where tenant_id = ? and month_for = ?`, [d.tenant_id, d.month_for]),
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

  try {
    await query(
      `insert into payments
         (pg_id, tenant_id, month_for, base_rent, electricity_charge, food_charge, other_charges,
          food_opt_out_deduction, amount_paid, payment_mode, verified, is_pro_rata, pro_rata_days)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on duplicate key update
         electricity_charge = values(electricity_charge)`,
      [
        pid, d.tenant_id, d.month_for, existing?.base_rent ?? derived.baseRent, charge,
        existing?.food_charge ?? 0, existing?.other_charges ?? 0,
        existing?.food_opt_out_deduction ?? derived.foodDeduction, existing?.amount_paid ?? 0,
        existing?.payment_mode ?? null, existing?.verified ?? false,
        existing?.is_pro_rata ?? derived.isProRata,
        existing?.pro_rata_days ?? (derived.isProRata ? derived.proRataDays : null),
      ],
    );
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }

  await notifyTenant(
    pid,
    d.tenant_id,
    `Electricity for ${d.month_for}: ₹${charge.toLocaleString("en-IN")} added to your bill.`,
    "/portal/bill",
  );
  revalidatePath("/dashboard/payments");
  revalidatePath(`/dashboard/tenants/${d.tenant_id}`);
  revalidatePath("/portal/bill");
  return { ok: true };
}

type Payment_ = {
  base_rent: number;
  electricity_charge: number;
  food_charge: number;
  other_charges: number;
  food_opt_out_deduction: number;
  amount_paid: number;
  payment_mode: string | null;
  verified: boolean;
  is_pro_rata: boolean;
  pro_rata_days: number | null;
};

/* -------------------------------- expenses ------------------------------- */

/** Built-in categories every property starts with (lowercase, kept in sync
 *  with DEFAULT_CATEGORIES in the add-expense dialog). */
const DEFAULT_EXPENSE_CATEGORIES = [
  "rent", "salaries", "utilities", "groceries", "maintenance", "supplies", "marketing", "other",
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

  try {
    await query(`insert into expenses (pg_id, category, subcategory, amount, expense_date, description, added_by) values (?, ?, ?, ?, ?, ?, ?)`, [
      pid,
      parsed.data.category,
      sub,
      parsed.data.amount,
      parsed.data.date,
      parsed.data.description || null,
      me.id,
    ]);
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }

  await Promise.all([
    DEFAULT_EXPENSE_CATEGORIES.includes(parsed.data.category.toLowerCase())
      ? Promise.resolve()
      : query(
          `insert into expense_categories (pg_id, name, parent) values (?, ?, '') on duplicate key update name = values(name)`,
          [pid, parsed.data.category],
        ),
    sub
      ? query(
          `insert into expense_categories (pg_id, name, parent) values (?, ?, ?) on duplicate key update name = values(name)`,
          [pid, sub, parsed.data.category],
        )
      : Promise.resolve(),
    logActivity(
      "expense.added",
      `Added expense ₹${parsed.data.amount.toLocaleString("en-IN")} · ${parsed.data.category}${sub ? ` / ${sub}` : ""}`,
    ),
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

  try {
    await query(`insert into expense_categories (pg_id, name, parent) values (?, ?, ?)`, [pid, name, parent]);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "ER_DUP_ENTRY") return { error: `That ${parent ? "sub-category" : "category"} already exists.` };
    return { error: humanizeDbError(error as never) };
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
  await query(`delete from expense_categories where pg_id = ? and name = ? and parent = ?`, [pid, name, parent]);
  if (!parent) {
    await query(`delete from expense_categories where pg_id = ? and parent = ?`, [pid, name]);
  }
  revalidatePath("/dashboard/expenses");
}

/** Owner confirms a tenant-submitted payment. */
export async function verifyPaymentAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  const p = await queryOne<{ pg_id: string; tenant_id: string; month_for: string }>(
    `select pg_id, tenant_id, month_for from payments where id = ? and pg_id = ?`,
    [id, pid],
  );
  if (!p) return;
  await query(`update payments set verified = true where id = ?`, [id]);
  await Promise.all([
    notifyTenant(p.pg_id, p.tenant_id, `Your payment for ${p.month_for} was confirmed ✓`, "/portal/bill"),
    logActivity("payment.verified", `Verified payment for ${p.month_for}`),
  ]);
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard");
  revalidatePath("/portal/bill");
}

/** Owner rejects a tenant-submitted payment: clears the claimed amount + proof
 *  so the bill returns to unpaid and the tenant can re-submit. */
export async function rejectPaymentAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  const p = await queryOne<{ pg_id: string; tenant_id: string; month_for: string }>(
    `select pg_id, tenant_id, month_for from payments where id = ? and pg_id = ?`,
    [id, pid],
  );
  if (!p) return;
  await query(
    `update payments set amount_paid = 0, verified = false, payment_mode = null, payment_date = null, payment_screenshot_url = null where id = ?`,
    [id],
  );
  await notifyTenant(
    p.pg_id,
    p.tenant_id,
    `Your payment for ${p.month_for} couldn't be confirmed — please re-submit.`,
    "/portal/bill",
  );
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard");
  revalidatePath("/portal/bill");
}

/** Owner deletes a payment record so the month becomes unpaid/upcoming again. */
export async function deletePaymentRecordAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  if (!id) return;
  await query(`delete from payments where id = ? and pg_id = ?`, [id, pid]);
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
  const t = await queryOne<{ id: string; pg_id: string }>(`select id, pg_id from tenants where id = ?`, [tenantId]);
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
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const id = String(formData.get("id"));
  const parsed = expenseUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    await query(
      `update expenses set category = ?, subcategory = ?, amount = ?, expense_date = ?, description = ? where id = ? and pg_id = ?`,
      [
        parsed.data.category,
        parsed.data.subcategory?.trim() || null,
        parsed.data.amount,
        parsed.data.date,
        parsed.data.description || null,
        id,
        pid,
      ],
    );
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "staff"]);
  if (!canDelete(me)) return;
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  await query(`delete from expenses where id = ? and pg_id = ?`, [id, pid]);
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
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const id = String(formData.get("id"));
  const parsed = issueEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    await query(`update issues set category = ?, description = ? where id = ? and pg_id = ?`, [
      parsed.data.category,
      parsed.data.description,
      id,
      pid,
    ]);
  } catch (error) {
    return { error: humanizeDbError(error as never) };
  }
  revalidatePath("/dashboard/issues");
  return { ok: true };
}

export async function deleteIssueAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "staff"]);
  if (!canDelete(me)) return;
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  await query(`delete from issues where id = ? and pg_id = ?`, [id, pid]);
  revalidatePath("/dashboard/issues");
  revalidatePath("/dashboard");
}

/* --------------------------------- issues -------------------------------- */

export async function setIssueStatusAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["open", "in_progress", "resolved"].includes(status)) return;
  const issue = await queryOne<{ tenant_id: string; pg_id: string }>(
    `select tenant_id, pg_id from issues where id = ? and pg_id = ?`,
    [id, pid],
  );
  if (!issue) return;
  await query(`update issues set status = ?, resolved_at = ? where id = ?`, [
    status,
    status === "resolved" ? new Date().toISOString() : null,
    id,
  ]);

  if (status === "resolved") {
    await notifyTenant(issue.pg_id, issue.tenant_id, "Your complaint was resolved ✓", "/portal/issues");
  }
  revalidatePath("/dashboard/issues");
  revalidatePath("/dashboard");
}
