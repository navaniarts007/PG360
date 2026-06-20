"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "../guards";
import { getActiveProperty } from "../auth";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { notifyTenant } from "../notify";
import { computeSettlement } from "../money";

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
  if (error || !room) return { error: error?.message ?? "Could not create the room." };

  const beds = Array.from({ length: d.total_beds }, (_, i) => ({
    pg_id: pid,
    room_id: room.id,
    bed_number: `${d.room_number}-${i + 1}`,
    rate_card_id: rc.id,
    price_per_month: rc.price_per_month,
  }));
  const { error: bedErr } = await s.from("beds").insert(beds);
  if (bedErr) return { error: bedErr.message };

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
  await requireRole(["admin", "staff"]);
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
  if (error) return { error: error.message };

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
  await requireRole(["admin", "staff"]);
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
  email: z.string().email("Enter a valid email."),
  aadhaar_number: z.string().optional(),
  bed_id: z.string().optional(),
  security_deposit: z.coerce.number().min(0),
  checkin_date: z.string().min(1, "Check-in date is required."),
  rent_due_day: z.coerce.number().int().min(1).max(28),
  login_password: z.string().min(6, "Password must be 6+ characters."),
  joining_fee: z.coerce.number().int().min(0).optional(),
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

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.login_password,
    email_confirm: true,
    user_metadata: { full_name: d.name },
  });
  if (userErr || !created.user) {
    return {
      error: /already|registered|exists/i.test(userErr?.message ?? "")
        ? "That email already has a login."
        : userErr?.message ?? "Could not create the tenant login.",
    };
  }

  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .insert({
      pg_id: pid,
      room_id: roomId,
      bed_id: bedId,
      user_id: created.user.id,
      name: d.name,
      phone: d.phone,
      email: d.email,
      aadhaar_number: d.aadhaar_number || null,
      rent_amount: rent,
      security_deposit: d.security_deposit,
      checkin_date: d.checkin_date,
      rent_due_day: d.rent_due_day,
    })
    .select()
    .single();
  if (tErr || !tenant) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: tErr?.message ?? "Could not create the tenant." };
  }

  await admin.from("profiles").upsert({
    id: created.user.id,
    role: "tenant",
    pg_id: pid,
    full_name: d.name,
    phone: d.phone,
  });

  if (bedId) {
    await admin
      .from("beds")
      .update({ status: "occupied", current_tenant_id: tenant.id })
      .eq("id", bedId);
  }

  // One-time joining/admission fee (non-refundable), if entered.
  if (d.joining_fee && d.joining_fee > 0) {
    await admin.from("joining_fees").insert({
      pg_id: pid,
      tenant_id: tenant.id,
      amount: d.joining_fee,
    });
  }

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
  email: z.string().email("Enter a valid email."),
  aadhaar_number: z.string().optional(),
  bed_id: z.string().optional(),
  security_deposit: z.coerce.number().min(0),
  rent_due_day: z.coerce.number().int().min(1).max(28),
});

export async function updateTenantAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
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

  const { error } = await s
    .from("tenants")
    .update({
      name: d.name,
      phone: d.phone,
      email: d.email,
      aadhaar_number: d.aadhaar_number || null,
      bed_id: newBedId,
      room_id: roomId,
      rent_amount: rent,
      security_deposit: d.security_deposit,
      rent_due_day: d.rent_due_day,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  if (tenant.bed_id !== newBedId) {
    if (tenant.bed_id) {
      await s.from("beds").update({ status: "vacant", current_tenant_id: null }).eq("id", tenant.bed_id);
    }
    if (newBedId && tenant.status === "active") {
      await s.from("beds").update({ status: "occupied", current_tenant_id: id }).eq("id", newBedId);
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
  const s = await createClient();

  const { data: tenant } = await s
    .from("tenants")
    .select("id, pg_id, rent_amount, security_deposit, lock_in_end_date, notice_given_date, status")
    .eq("id", d.tenant_id)
    .maybeSingle();
  if (!tenant || tenant.pg_id !== pid) return { error: "Tenant not found in this property." };

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
  });

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
    refundable_amount: res.refundableAmount,
    notes: d.notes || null,
    status: "confirmed",
  });
  if (insErr) return { error: insErr.message };

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
    await s.from("beds").update({ status: "vacant", current_tenant_id: null }).eq("current_tenant_id", d.tenant_id);
  }

  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${d.tenant_id}`);
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteTenantAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const s = await createClient();
  const { data: tenant } = await s
    .from("tenants")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (!tenant) return;
  await s.from("beds").update({ status: "vacant", current_tenant_id: null }).eq("current_tenant_id", id);
  await s.from("tenants").delete().eq("id", id); // cascades payments/issues/food_opt
  if (tenant.user_id) {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(tenant.user_id);
  }
  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
}

/* -------------------------------- payments ------------------------------- */

const paymentSchema = z.object({
  tenant_id: z.string().min(1),
  month_for: z.string().min(1),
  base_rent: z.coerce.number().min(0),
  electricity_charge: z.coerce.number().min(0),
  food_charge: z.coerce.number().min(0),
  other_charges: z.coerce.number().min(0),
  amount_paid: z.coerce.number().min(0),
  payment_mode: z.enum(["cash", "upi", "bank"]),
  notes: z.string().optional(),
});

export async function recordPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["admin", "staff"]);
  const pid = await getActiveProperty();
  if (!pid) return { error: "No active property selected." };
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const s = await createClient();

  const { data: tenant } = await s
    .from("tenants")
    .select("id, pg_id")
    .eq("id", d.tenant_id)
    .maybeSingle();
  if (!tenant || tenant.pg_id !== pid) return { error: "That tenant is not in this property." };

  const { error } = await s.from("payments").upsert(
    {
      pg_id: pid,
      tenant_id: d.tenant_id,
      month_for: d.month_for,
      base_rent: d.base_rent,
      electricity_charge: d.electricity_charge,
      food_charge: d.food_charge,
      other_charges: d.other_charges,
      amount_paid: d.amount_paid,
      payment_mode: d.payment_mode,
      payment_date: d.amount_paid > 0 ? new Date().toISOString().slice(0, 10) : null,
      verified: true, // admin-recorded payments are trusted
      notes: d.notes || null,
    },
    { onConflict: "tenant_id,month_for" },
  );
  if (error) return { error: error.message };

  await notifyTenant(pid, d.tenant_id, `Your payment for ${d.month_for} was recorded.`, "/portal/bill");
  revalidatePath("/dashboard/payments");
  revalidatePath("/dashboard");
  return { ok: true };
}

/* -------------------------------- expenses ------------------------------- */

const expenseSchema = z.object({
  category: z.enum([
    "rent",
    "salaries",
    "utilities",
    "groceries",
    "maintenance",
    "supplies",
    "marketing",
    "other",
  ]),
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
  const s = await createClient();
  const { error } = await s.from("expenses").insert({
    pg_id: pid,
    category: parsed.data.category,
    amount: parsed.data.amount,
    date: parsed.data.date,
    description: parsed.data.description || null,
    added_by: me.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}

/** Owner confirms a tenant-submitted payment. */
export async function verifyPaymentAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const s = await createClient();
  await s.from("payments").update({ verified: true }).eq("id", id);
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
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const parsed = expenseUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const s = await createClient();
  const { error } = await s
    .from("expenses")
    .update({
      category: parsed.data.category,
      amount: parsed.data.amount,
      date: parsed.data.date,
      description: parsed.data.description || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
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
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const parsed = issueEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const s = await createClient();
  const { error } = await s
    .from("issues")
    .update({ category: parsed.data.category, description: parsed.data.description })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/issues");
  return { ok: true };
}

export async function deleteIssueAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
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
