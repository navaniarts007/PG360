"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "../guards";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";

export type ActionState = { ok?: boolean; error?: string };

/* --------------------------------- rooms --------------------------------- */

const roomSchema = z.object({
  room_number: z.string().min(1, "Room number is required."),
  floor: z.coerce.number().int().min(0),
  type: z.enum(["single", "double", "triple"]),
  total_beds: z.coerce.number().int().min(1, "At least 1 bed."),
  rent_amount: z.coerce.number().min(0),
  wifi_password: z.string().min(1, "WiFi password is required."),
  amenities: z.string().optional(),
});

export async function addRoomAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["admin", "staff"]);
  if (!me.pg_id) return { error: "No PG attached to your account." };
  const parsed = roomSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { amenities, ...rest } = parsed.data;
  const s = await createClient();
  const { error } = await s.from("rooms").insert({
    pg_id: me.pg_id,
    occupied_beds: 0,
    amenities: (amenities ?? "").split(",").map((a) => a.trim()).filter(Boolean),
    ...rest,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}

/* -------------------------------- tenants -------------------------------- */

const tenantSchema = z.object({
  name: z.string().min(2, "Name is required."),
  phone: z.string().min(8, "Enter a valid phone."),
  email: z.string().email("Enter a valid email."),
  aadhaar_number: z.string().optional(),
  room_id: z.string().optional(),
  rent_amount: z.coerce.number().min(0),
  security_deposit: z.coerce.number().min(0),
  checkin_date: z.string().min(1, "Check-in date is required."),
  rent_due_day: z.coerce.number().int().min(1).max(28),
  login_password: z.string().min(6, "Password must be 6+ characters."),
});

export async function addTenantAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireRole(["admin", "staff"]);
  if (!me.pg_id) return { error: "No PG attached to your account." };
  const parsed = tenantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const roomId = d.room_id && d.room_id !== "none" ? d.room_id : null;
  const admin = createAdminClient();

  // tenant login
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

  const { error: tErr } = await admin.from("tenants").insert({
    pg_id: me.pg_id,
    room_id: roomId,
    user_id: created.user.id,
    name: d.name,
    phone: d.phone,
    email: d.email,
    aadhaar_number: d.aadhaar_number || null,
    rent_amount: d.rent_amount,
    security_deposit: d.security_deposit,
    checkin_date: d.checkin_date,
    rent_due_day: d.rent_due_day,
  });
  if (tErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: tErr.message };
  }

  await admin.from("profiles").upsert({
    id: created.user.id,
    role: "tenant",
    pg_id: me.pg_id,
    full_name: d.name,
    phone: d.phone,
  });

  // occupy a bed
  if (roomId) {
    const { data: room } = await admin
      .from("rooms")
      .select("occupied_beds, total_beds")
      .eq("id", roomId)
      .maybeSingle();
    if (room && room.occupied_beds < room.total_beds) {
      await admin.from("rooms").update({ occupied_beds: room.occupied_beds + 1 }).eq("id", roomId);
    }
  }

  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function checkoutTenantAction(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const s = await createClient();
  const { data: tenant } = await s
    .from("tenants")
    .select("id, pg_id, room_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!tenant || tenant.pg_id !== me.pg_id || tenant.status === "checked_out") return;

  await s
    .from("tenants")
    .update({ status: "checked_out", checkout_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id);

  if (tenant.room_id) {
    const { data: room } = await s
      .from("rooms")
      .select("occupied_beds")
      .eq("id", tenant.room_id)
      .maybeSingle();
    if (room && room.occupied_beds > 0) {
      await s.from("rooms").update({ occupied_beds: room.occupied_beds - 1 }).eq("id", tenant.room_id);
    }
  }

  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${id}`);
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
  const me = await requireRole(["admin", "staff"]);
  if (!me.pg_id) return { error: "No PG attached to your account." };
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const s = await createClient();

  const { data: tenant } = await s
    .from("tenants")
    .select("id, pg_id")
    .eq("id", d.tenant_id)
    .maybeSingle();
  if (!tenant || tenant.pg_id !== me.pg_id) return { error: "That tenant is not in your PG." };

  // total_amount + status are derived by a DB trigger.
  const { error } = await s.from("payments").upsert(
    {
      pg_id: me.pg_id,
      tenant_id: d.tenant_id,
      month_for: d.month_for,
      base_rent: d.base_rent,
      electricity_charge: d.electricity_charge,
      food_charge: d.food_charge,
      other_charges: d.other_charges,
      amount_paid: d.amount_paid,
      payment_mode: d.payment_mode,
      payment_date: d.amount_paid > 0 ? new Date().toISOString().slice(0, 10) : null,
      notes: d.notes || null,
    },
    { onConflict: "tenant_id,month_for" },
  );
  if (error) return { error: error.message };

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
  if (!me.pg_id) return { error: "No PG attached to your account." };
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const s = await createClient();
  const { error } = await s.from("expenses").insert({
    pg_id: me.pg_id,
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

/* --------------------------------- issues -------------------------------- */

export async function setIssueStatusAction(formData: FormData): Promise<void> {
  await requireRole(["admin", "staff"]);
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["open", "in_progress", "resolved"].includes(status)) return;
  const s = await createClient();
  await s
    .from("issues")
    .update({
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  revalidatePath("/dashboard/issues");
  revalidatePath("/dashboard");
}
