import "server-only";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { getActiveProperty, getSession } from "./auth";
import { v2 as cloudinary } from "cloudinary";
import { computeBill } from "./money";
import { dueDateFor } from "./rent";

let cldReady = false;
function cld() {
  if (!cldReady) {
    cloudinary.config({
      cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    cldReady = true;
  }
  return cloudinary;
}
import type {
  ActivityEntry,
  AgreementSection,
  AppNotification,
  Bed,
  CheckoutSettlement,
  Expense,
  Floor,
  FoodMenuItem,
  Issue,
  JoiningFee,
  MealType,
  Payment,
  PgAccount,
  PlatformInvoice,
  PgPolicy,
  RateCard,
  Room,
  Tenant,
  TenantAgreement,
  TenantDocument,
  TenantEvent,
  WifiNetwork,
} from "./types";

/* =========================================================================
   Supabase-backed data access. RLS does the pg/tenant scoping, so most reads
   are plain `select *` — the policies guarantee the caller only sees their rows.
   ========================================================================= */

const sb = () => createClient();

/* ------------------------------------------------------------- platform */

export async function listPgAccounts(): Promise<PgAccount[]> {
  const s = await sb();
  const { data } = await s
    .from("pg_accounts")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as PgAccount[];
}

/** Properties the current admin/staff is a member of (RLS-scoped). */
export async function listMyProperties(): Promise<PgAccount[]> {
  const s = await sb();
  const { data } = await s
    .from("pg_accounts")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []) as PgAccount[];
}

export async function getPgAccount(id: string): Promise<PgAccount | null> {
  const s = await sb();
  const { data } = await s.from("pg_accounts").select("*").eq("id", id).maybeSingle();
  return (data as PgAccount) ?? null;
}

/** Recent tenant activity for one PG (super-admin account view). */
export async function getAccountActivity(
  pgId: string,
  limit = 15,
): Promise<Array<TenantEvent & { tenant_name: string }>> {
  const s = await sb();
  const { data } = await s
    .from("tenant_events")
    .select("*, tenant:tenants(name)")
    .eq("pg_id", pgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  type Row = TenantEvent & { tenant: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((e) => ({
    ...e,
    tenant_name: e.tenant?.name ?? "Tenant",
  }));
}

/** All PG360 invoices across the platform (super-admin), newest first. */
export async function listAllInvoices(): Promise<
  Array<PlatformInvoice & { pg_name: string }>
> {
  const s = await sb();
  const { data } = await s
    .from("platform_invoices")
    .select("*, pg:pg_accounts(pg_name)")
    .order("created_at", { ascending: false });
  type Row = PlatformInvoice & { pg: { pg_name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((iv) => ({
    ...iv,
    pg_name: iv.pg?.pg_name ?? "—",
  }));
}

/** Turn a stored KYC value into a viewable URL. New uploads store a private
 *  Cloudinary asset as "cld:<public_id>.<format>" → return a signed authenticated
 *  delivery URL (not openable without our secret). Legacy public Cloudinary URLs
 *  are returned as-is; a leftover Supabase path is signed from storage. */
export async function getKycSignedUrl(value: string | null): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("cld:")) {
    const rest = value.slice(4);
    const dot = rest.lastIndexOf(".");
    const publicId = dot > 0 ? rest.slice(0, dot) : rest;
    const format = dot > 0 ? rest.slice(dot + 1) : "jpg";
    return cld().url(publicId, {
      type: "authenticated",
      resource_type: "image",
      format,
      sign_url: true,
      secure: true,
    });
  }
  if (/^https?:\/\//i.test(value)) return value; // legacy public Cloudinary
  const admin = createAdminClient(); // leftover private Supabase path
  const { data } = await admin.storage.from("kyc").createSignedUrl(value, 60 * 10);
  return data?.signedUrl ?? null;
}

/** Activity log for the active property (admin/staff view). */
export async function listActivity(limit = 200): Promise<ActivityEntry[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  if (!pid) return [];
  const { data } = await s
    .from("activity_log")
    .select("*")
    .eq("pg_id", pid)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ActivityEntry[];
}

/** Platform-wide activity log (super-admin), with the PG name resolved. */
export async function listAllActivity(
  limit = 300,
): Promise<Array<ActivityEntry & { pg_name: string | null }>> {
  const s = await sb();
  const { data } = await s
    .from("activity_log")
    .select("*, pg:pg_accounts(pg_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  type Row = ActivityEntry & { pg: { pg_name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => ({ ...r, pg_name: r.pg?.pg_name ?? null }));
}

/** The login email for an auth user (super-admin account view). */
export async function getAuthEmail(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

/** PG360 subscription invoices for one PG (super-admin / owner read). */
export async function listInvoices(pgId: string): Promise<PlatformInvoice[]> {
  const s = await sb();
  const { data } = await s
    .from("platform_invoices")
    .select("*")
    .eq("pg_id", pgId)
    .order("created_at", { ascending: false });
  return (data ?? []) as PlatformInvoice[];
}

/** One invoice + its billed PG account (for the printable invoice page). */
export async function getInvoiceWithPg(
  id: string,
): Promise<{ invoice: PlatformInvoice; pg: PgAccount } | null> {
  const s = await sb();
  const { data: invoice } = await s
    .from("platform_invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!invoice) return null;
  const { data: pg } = await s
    .from("pg_accounts")
    .select("*")
    .eq("id", (invoice as PlatformInvoice).pg_id)
    .maybeSingle();
  if (!pg) return null;
  return { invoice: invoice as PlatformInvoice, pg: pg as PgAccount };
}

/** Headline counts for one PG (super-admin account view). */
export async function getAccountStats(
  pgId: string,
): Promise<{ tenants: number; rooms: number }> {
  const s = await sb();
  const [t, r] = await Promise.all([
    s.from("tenants").select("id", { count: "exact", head: true }).eq("pg_id", pgId).eq("status", "active"),
    s.from("rooms").select("id", { count: "exact", head: true }).eq("pg_id", pgId),
  ]);
  return { tenants: t.count ?? 0, rooms: r.count ?? 0 };
}

/** The active property's money policy, guaranteed non-null (schema defaults when
 *  no row exists yet) — convenient for settings forms. */
export async function getPgPolicy(pgId: string): Promise<PgPolicy> {
  const s = await sb();
  const { data } = await s.from("pg_policies").select("*").eq("pg_id", pgId).maybeSingle();
  if (data) return data as PgPolicy;
  return {
    id: "",
    pg_id: pgId,
    notice_period_days: 30,
    lock_in_months: 0,
    deposit_months: 1,
    electricity_included_units: 0,
    electricity_per_unit_rate: 0,
    created_at: "",
  };
}

export async function platformStats() {
  const s = await sb();
  const [{ data: pgs }, { count: tenantCount }, { data: paid }] = await Promise.all([
    s.from("pg_accounts").select("status, is_demo"),
    s.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active"),
    s.from("platform_invoices").select("amount, tax_percent").eq("status", "paid"),
  ]);
  const rows = (pgs ?? []) as { status: string; is_demo: boolean }[];
  const active = rows.filter((p) => p.status === "active");
  const demoPgs = rows.filter((p) => p.is_demo).length;
  const payingPgs = active.filter((p) => !p.is_demo).length;
  // real revenue = money actually invoiced & marked paid (not a plan estimate)
  const revenue = ((paid ?? []) as { amount: number; tax_percent: number }[]).reduce(
    (sum, iv) => sum + iv.amount + Math.round((iv.amount * iv.tax_percent) / 100),
    0,
  );
  return {
    totalPgs: rows.length,
    activePgs: active.length,
    demoPgs,
    payingPgs,
    totalTenants: tenantCount ?? 0,
    revenue,
  };
}

/* ---------------------------------------------------------------- rooms */

export async function listRooms(): Promise<Room[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s
    .from("rooms")
    .select("*")
    .eq("pg_id", pid)
    .order("room_number");
  return (data ?? []) as Room[];
}

/* -------------------------------------------------------------- floors */

export async function listFloors(): Promise<Floor[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s
    .from("floors")
    .select("*")
    .eq("pg_id", pid)
    .order("sort_order")
    .order("name");
  return (data ?? []) as Floor[];
}

export interface FloorWithRooms {
  floor: Floor;
  rooms: RoomBeds[];
}

/** Floors (including empty ones) with their rooms + beds, for the floor view. */
export async function listFloorsWithRooms(): Promise<FloorWithRooms[]> {
  const [floors, roomBeds] = await Promise.all([listFloors(), listBedsByRoom()]);
  const byFloor = new Map<string, RoomBeds[]>();
  for (const rb of roomBeds) {
    const key = rb.room.floor_id ?? "__none__";
    const list = byFloor.get(key) ?? [];
    list.push(rb);
    byFloor.set(key, list);
  }
  return floors.map((floor) => ({ floor, rooms: byFloor.get(floor.id) ?? [] }));
}

export async function getFloorOptions(): Promise<{ id: string; label: string }[]> {
  const floors = await listFloors();
  return floors.map((f) => ({ id: f.id, label: f.name }));
}

/** One floor + its rooms/beds (for the dedicated floor page). */
export async function getFloorDetail(
  floorId: string,
): Promise<{ floor: Floor; rooms: RoomBeds[] } | null> {
  const s = await sb();
  const { data: floor } = await s.from("floors").select("*").eq("id", floorId).maybeSingle();
  if (!floor) return null;
  const { data: rooms } = await s
    .from("rooms")
    .select("*")
    .eq("floor_id", floorId)
    .order("room_number");
  const roomList = (rooms ?? []) as Room[];
  const roomIds = roomList.map((r) => r.id);
  const [{ data: beds }, { data: tenants }] = await Promise.all([
    roomIds.length
      ? s.from("beds").select("*").in("room_id", roomIds).order("bed_number")
      : Promise.resolve({ data: [] as Bed[] }),
    s.from("tenants").select("id, name").eq("pg_id", (floor as Floor).pg_id),
  ]);
  const nameById = new Map((tenants ?? []).map((t) => [t.id as string, t.name as string]));
  const bedsByRoom = new Map<string, Array<Bed & { tenant_name: string | null }>>();
  for (const b of (beds ?? []) as Bed[]) {
    const list = bedsByRoom.get(b.room_id) ?? [];
    list.push({ ...b, tenant_name: b.current_tenant_id ? nameById.get(b.current_tenant_id) ?? null : null });
    bedsByRoom.set(b.room_id, list);
  }
  return {
    floor: floor as Floor,
    rooms: roomList.map((room) => ({ room, beds: bedsByRoom.get(room.id) ?? [] })),
  };
}

/* ----------------------------------------------------- rate cards / beds */

export async function listRateCards(): Promise<RateCard[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s
    .from("rate_cards")
    .select("*")
    .eq("pg_id", pid)
    .order("price_per_month", { ascending: false });
  return (data ?? []) as RateCard[];
}

/* ----------------------------------------------- tenant records (events) */

export async function listTenantEvents(tenantId: string): Promise<TenantEvent[]> {
  const s = await sb();
  const { data } = await s
    .from("tenant_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data ?? []) as TenantEvent[];
}

/** Recent activity across the active property (for the GVM home feed). */
export async function listRecentEvents(
  limit = 12,
): Promise<Array<TenantEvent & { tenant_name: string }>> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s
    .from("tenant_events")
    .select("*, tenant:tenants(name)")
    .eq("pg_id", pid)
    .order("created_at", { ascending: false })
    .limit(limit);
  type Row = TenantEvent & { tenant: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((e) => ({
    ...e,
    tenant_name: e.tenant?.name ?? "Tenant",
  }));
}

/** Checked-out tenants (the "Vacated Master") for the active property. */
export async function listVacated(): Promise<
  Array<Tenant & { room_number: string | null }>
> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s
    .from("tenants")
    .select("*, room:rooms(room_number)")
    .eq("pg_id", pid)
    .eq("status", "checked_out")
    .order("checkout_date", { ascending: false });
  type Row = Tenant & { room: { room_number: string } | null };
  return ((data ?? []) as unknown as Row[]).map((t) => ({
    ...t,
    room_number: t.room?.room_number ?? null,
  }));
}

/** How many beds currently price off each rate card (for the Pricing page). */
export async function rateCardBedCounts(): Promise<Record<string, number>> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s.from("beds").select("rate_card_id").eq("pg_id", pid);
  const counts: Record<string, number> = {};
  for (const b of (data ?? []) as { rate_card_id: string | null }[]) {
    if (b.rate_card_id) counts[b.rate_card_id] = (counts[b.rate_card_id] ?? 0) + 1;
  }
  return counts;
}

/* ------------------------------------------------------------- wifi master */

export async function listWifiNetworks(): Promise<WifiNetwork[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s
    .from("wifi_networks")
    .select("*")
    .eq("pg_id", pid)
    .order("ssid");
  return (data ?? []) as WifiNetwork[];
}

export interface RoomBeds {
  room: Room;
  beds: Array<Bed & { tenant_name: string | null }>;
}

/** Bed-level occupancy grouped by room (the view Bangalore owners want). */
export async function listBedsByRoom(): Promise<RoomBeds[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const [{ data: beds }, rooms, { data: tenants }] = await Promise.all([
    s.from("beds").select("*").eq("pg_id", pid).order("bed_number"),
    listRooms(),
    s.from("tenants").select("id, name").eq("pg_id", pid),
  ]);
  const nameById = new Map((tenants ?? []).map((t) => [t.id as string, t.name as string]));
  const bedsByRoom = new Map<string, Array<Bed & { tenant_name: string | null }>>();
  for (const b of (beds ?? []) as Bed[]) {
    const list = bedsByRoom.get(b.room_id) ?? [];
    list.push({ ...b, tenant_name: b.current_tenant_id ? nameById.get(b.current_tenant_id) ?? null : null });
    bedsByRoom.set(b.room_id, list);
  }
  return rooms.map((room) => ({ room, beds: bedsByRoom.get(room.id) ?? [] }));
}

export interface BedOption {
  id: string;
  label: string;
  price: number;
  room_id: string;
  status: "vacant" | "occupied";
}

/** All beds in the active property as picker options. The dialog filters to
 *  vacant beds (plus the tenant's own bed when editing). */
export async function getBedOptions(): Promise<BedOption[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data: beds } = await s
    .from("beds")
    .select("id, bed_number, price_per_month, room_id, status")
    .eq("pg_id", pid)
    .order("bed_number");
  const rooms = await listRooms();
  const roomNo = new Map(rooms.map((r) => [r.id, r.room_number]));
  type Row = { id: string; bed_number: string; price_per_month: number; room_id: string; status: "vacant" | "occupied" };
  return ((beds ?? []) as Row[]).map((b) => ({
    id: b.id,
    label: `Room ${roomNo.get(b.room_id) ?? "?"} · Bed ${b.bed_number} · ₹${b.price_per_month.toLocaleString("en-IN")}/mo`,
    price: b.price_per_month,
    room_id: b.room_id,
    status: b.status,
  }));
}

/* -------------------------------------------------------------- tenants */

type TenantRow = Tenant & { room: { room_number: string; floor: number } | null };

export async function listTenantsWithRoom(): Promise<TenantRow[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s
    .from("tenants")
    .select("*, room:rooms(room_number, floor)")
    .eq("pg_id", pid)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });
  // to-one FK embeds return objects at runtime; cast through unknown.
  return (data ?? []) as unknown as TenantRow[];
}

export interface PayTenant {
  id: string;
  name: string;
  rent_amount: number;
  room_label: string;
}

export async function getPayTenants(): Promise<PayTenant[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s
    .from("tenants")
    .select("id, name, rent_amount, status, room:rooms(room_number)")
    .eq("pg_id", pid)
    .eq("status", "active");
  type Row = {
    id: string;
    name: string;
    rent_amount: number;
    room: { room_number: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((t) => ({
    id: t.id,
    name: t.name,
    rent_amount: t.rent_amount,
    room_label: t.room ? `Room ${t.room.room_number}` : "Unassigned",
  }));
}

export async function getTenantDetail(id: string): Promise<{
  tenant: Tenant;
  room: Room | null;
  payments: Payment[];
} | null> {
  const s = await sb();
  const { data: tenant } = await s.from("tenants").select("*").eq("id", id).maybeSingle();
  if (!tenant) return null;
  const t = tenant as Tenant;
  const [{ data: room }, { data: payments }] = await Promise.all([
    t.room_id
      ? s.from("rooms").select("*").eq("id", t.room_id).maybeSingle()
      : Promise.resolve({ data: null }),
    s.from("payments").select("*").eq("tenant_id", id).order("month_for", { ascending: false }),
  ]);
  return {
    tenant: t,
    room: (room as Room) ?? null,
    payments: (payments ?? []) as Payment[],
  };
}

/* ------------------------------------------------------------- payments */

export async function adminKpis(month: string) {
  const s = await sb();
  const pid = await getActiveProperty();
  const [{ data: rooms }, { data: tenants }, { data: payments }, { data: pg }] = await Promise.all([
    s.from("rooms").select("total_beds, occupied_beds").eq("pg_id", pid),
    s.from("tenants").select("id, rent_amount, checkin_date, food_opt_out, stay_type").eq("pg_id", pid).eq("status", "active"),
    s.from("payments").select("tenant_id, total_amount, amount_paid").eq("pg_id", pid).eq("month_for", month),
    s.from("pg_accounts").select("food_opt_out_deduction").eq("id", pid).maybeSingle(),
  ]);
  const r = (rooms ?? []) as { total_beds: number; occupied_beds: number }[];
  const t = (tenants ?? []) as { id: string; rent_amount: number; checkin_date: string; food_opt_out: boolean; stay_type: "monthly" | "daily" }[];
  const p = (payments ?? []) as { tenant_id: string; total_amount: number; amount_paid: number }[];
  const foodDeduction = (pg as { food_opt_out_deduction: number } | null)?.food_opt_out_deduction ?? 0;
  const payByTenant = new Map(p.map((x) => [x.tenant_id, x]));
  const totalBeds = r.reduce((sum, x) => sum + x.total_beds, 0);
  const occupiedBeds = r.reduce((sum, x) => sum + x.occupied_beds, 0);
  const collected = p.reduce((sum, x) => sum + x.amount_paid, 0);
  // billed counts EVERY active tenant — derived (pro-rata + food) when not yet invoiced
  const billed = t.reduce((sum, x) => {
    const invoiced = payByTenant.get(x.id)?.total_amount;
    if (invoiced != null) return sum + invoiced;
    // day-wise: the whole-stay total counts once, in the check-in month
    if (x.stay_type === "daily") {
      return sum + (x.checkin_date.slice(0, 7) === month ? x.rent_amount : 0);
    }
    return (
      sum +
      computeBill({
        pricePerMonth: x.rent_amount,
        checkinISO: x.checkin_date,
        month,
        foodOptOut: x.food_opt_out,
        foodOptOutDeduction: foodDeduction,
      }).total
    );
  }, 0);
  return {
    totalTenants: t.length,
    roomCount: r.length,
    totalBeds,
    occupiedBeds,
    occupancyPct: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    collected,
    due: Math.max(billed - collected, 0),
    billed,
  };
}

export interface BillRow {
  tenant_id: string;
  name: string;
  room: string;
  paymentId: string | null;
  total: number;
  paid: number;
  balance: number;
  status: "paid" | "partial" | "due";
  verified: boolean;
  payment_mode: string | null;
  screenshot_url: string | null;
  rent_due_day: number;
  checkin_date: string;
  due_date: string;
}

/** Every active tenant's bill for the month — a real invoice row if recorded,
 *  else derived from their rent (so the owner always sees who is due). */
export async function getMonthBill(month: string): Promise<BillRow[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const [{ data: tenants }, { data: pays }, { data: pg }] = await Promise.all([
    s
      .from("tenants")
      .select("id, name, rent_amount, checkin_date, rent_due_day, food_opt_out, stay_type, daily_rate, stay_days, room:rooms(room_number)")
      .eq("pg_id", pid)
      .eq("status", "active"),
    s.from("payments").select("*").eq("pg_id", pid).eq("month_for", month),
    s.from("pg_accounts").select("food_opt_out_deduction").eq("id", pid).maybeSingle(),
  ]);
  const foodDeduction = (pg as { food_opt_out_deduction: number } | null)?.food_opt_out_deduction ?? 0;
  const payByTenant = new Map(((pays ?? []) as Payment[]).map((p) => [p.tenant_id, p]));
  type T = {
    id: string;
    name: string;
    rent_amount: number;
    checkin_date: string;
    rent_due_day: number;
    food_opt_out: boolean;
    stay_type: "monthly" | "daily";
    daily_rate: number | null;
    stay_days: number | null;
    room: { room_number: string } | null;
  };
  const order = { due: 0, partial: 1, paid: 2 } as const;
  return ((tenants ?? []) as unknown as T[])
    .map((t): BillRow | null => {
      const p = payByTenant.get(t.id);

      // Day-wise stay: one total for the whole stay, billed once in the
      // check-in month (and collected on arrival). Skip every other month.
      if (t.stay_type === "daily") {
        if (t.checkin_date.slice(0, 7) !== month) return null;
        const total = p?.total_amount ?? t.rent_amount;
        const paid = p?.amount_paid ?? 0;
        return {
          tenant_id: t.id,
          name: t.name,
          room: t.room?.room_number ?? "—",
          paymentId: p?.id ?? null,
          total,
          paid,
          balance: Math.max(total - paid, 0),
          status: (p?.status ?? "due") as BillRow["status"],
          verified: p?.verified ?? false,
          payment_mode: p?.payment_mode ?? null,
          screenshot_url: p?.payment_screenshot_url ?? null,
          rent_due_day: t.rent_due_day,
          checkin_date: t.checkin_date,
          due_date: t.checkin_date, // collect on arrival
        };
      }

      // Monthly: derive the Bangalore way (pro-rata first month, food included
      // by default with an opt-out deduction).
      const derived = computeBill({
        pricePerMonth: t.rent_amount,
        checkinISO: t.checkin_date,
        month,
        foodOptOut: t.food_opt_out,
        foodOptOutDeduction: foodDeduction,
      });
      const total = p?.total_amount ?? derived.total;
      const paid = p?.amount_paid ?? 0;
      return {
        tenant_id: t.id,
        name: t.name,
        room: t.room?.room_number ?? "—",
        paymentId: p?.id ?? null,
        total,
        paid,
        balance: Math.max(total - paid, 0),
        status: (p?.status ?? "due") as BillRow["status"],
        verified: p?.verified ?? false,
        payment_mode: p?.payment_mode ?? null,
        screenshot_url: p?.payment_screenshot_url ?? null,
        rent_due_day: t.rent_due_day,
        checkin_date: t.checkin_date,
        due_date: dueDateFor(month, t.rent_due_day),
      };
    })
    .filter((r): r is BillRow => r !== null)
    .sort((a, b) => order[a.status] - order[b.status] || b.balance - a.balance);
}

export async function listStaff(): Promise<
  { id: string; full_name: string; phone: string | null; role: string; permissions: import("./types").StaffPermissions | null }[]
> {
  // RLS only lets a user see their own membership + profile rows, so reading the
  // team needs the service client. Safe: the staff page is admin-only and we
  // scope strictly to the caller's validated active property.
  const s = createAdminClient();
  const pid = await getActiveProperty();
  if (!pid) return [];
  // members of the active property who are staff (+ the owner admins)
  const { data: members } = await s
    .from("property_members")
    .select("user_id, role")
    .eq("property_id", pid);
  const ids = ((members ?? []) as { user_id: string; role: string }[]).map((m) => m.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await s
    .from("profiles")
    .select("id, full_name, phone, role, permissions")
    .in("id", ids);
  return ((profiles ?? []) as {
    id: string;
    full_name: string;
    phone: string | null;
    role: string;
    permissions: import("./types").StaffPermissions | null;
  }[]).filter((p) => p.role === "staff" || p.role === "admin");
}

type PaymentRow = Payment & {
  tenant: { name: string; room: { room_number: string } | null } | null;
};

export async function getMonthPayments(
  month: string,
): Promise<Array<Payment & { name: string; room: string }>> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s
    .from("payments")
    .select("*, tenant:tenants(name, room:rooms(room_number))")
    .eq("pg_id", pid)
    .eq("month_for", month);
  return ((data ?? []) as unknown as PaymentRow[]).map((p) => ({
    ...p,
    name: p.tenant?.name ?? "—",
    room: p.tenant?.room?.room_number ?? "—",
  }));
}

/* --------------------------------------------------------------- issues */

type IssueRow = Issue & {
  tenant: { name: string; room: { room_number: string } | null } | null;
};

export async function listIssuesWithTenant(): Promise<
  Array<Issue & { tenant_name: string; room_number: string | null }>
> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s
    .from("issues")
    .select("*, tenant:tenants(name, room:rooms(room_number))")
    .eq("pg_id", pid)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as IssueRow[]).map((i) => ({
    ...i,
    tenant_name: i.tenant?.name ?? "Tenant",
    room_number: i.tenant?.room?.room_number ?? null,
  }));
}

/* ----------------------------------------------------------- tenant self */

export async function getMyTenant(): Promise<{
  tenant: Tenant;
  room: Room | null;
} | null> {
  const s = await sb();
  const { data } = await s
    .from("tenants")
    .select("*, room:rooms(*)")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const { room, ...tenant } = data as unknown as Tenant & { room: Room | null };
  return { tenant: tenant as Tenant, room: (room as Room) ?? null };
}

export async function getMyPg(): Promise<PgAccount | null> {
  const s = await sb();
  const { data } = await s.from("pg_accounts").select("*").limit(1).maybeSingle();
  return (data as PgAccount) ?? null;
}

export async function getMyPayments(): Promise<Payment[]> {
  const s = await sb();
  const { data } = await s
    .from("payments")
    .select("*")
    .order("month_for", { ascending: false });
  return (data ?? []) as Payment[];
}

/** The signed-in tenant's outstanding rent reminder, or null if nothing's due.
 *  Handles both monthly and day-wise stays. */
export async function myRentReminder(): Promise<{
  balance: number;
  total: number;
  dueDate: string;
  overdue: boolean;
} | null> {
  const mine = await getMyTenant();
  if (!mine) return null;
  const t = mine.tenant;
  const month = new Date().toISOString().slice(0, 7);
  const [payments, pg] = await Promise.all([getMyPayments(), getMyPg()]);
  const cur = payments.find((p) => p.month_for === month);

  let total: number;
  let dueDate: string;
  if (t.stay_type === "daily") {
    total = cur?.total_amount ?? Math.round((t.daily_rate ?? 0) * (t.stay_days ?? 0));
    dueDate = t.checkin_date; // collected on arrival
  } else {
    const derived = computeBill({
      pricePerMonth: t.rent_amount,
      checkinISO: t.checkin_date,
      month,
      foodOptOut: t.food_opt_out,
      foodOptOutDeduction: pg?.food_opt_out_deduction ?? 0,
    });
    total = cur?.total_amount ?? derived.total;
    dueDate = dueDateFor(month, t.rent_due_day);
  }
  const paid = cur?.amount_paid ?? 0;
  const balance = Math.max(total - paid, 0);
  if (balance <= 0) return null;
  const overdue = new Date().toISOString().slice(0, 10) > dueDate;
  return { balance, total, dueDate, overdue };
}

/* ----------------------------------------------------- agreements -------- */

/** The PG's ordered policy sections (staff/admin view). */
export async function listAgreementSections(pgId: string): Promise<AgreementSection[]> {
  const s = await sb();
  const { data } = await s
    .from("agreement_sections")
    .select("*")
    .eq("pg_id", pgId)
    .order("idx", { ascending: true });
  return (data ?? []) as AgreementSection[];
}

/** The signed-in tenant's PG policy sections (for the agreement screen). */
export async function getMyAgreementSections(): Promise<AgreementSection[]> {
  const s = await sb();
  const { data } = await s
    .from("agreement_sections")
    .select("*")
    .order("idx", { ascending: true });
  return (data ?? []) as AgreementSection[];
}

/** The signed-in tenant's agreement row, if they've signed. */
export async function myAgreement(): Promise<TenantAgreement | null> {
  const me = await getSession();
  if (!me?.tenant_id) return null;
  const s = await sb();
  const { data } = await s
    .from("tenant_agreements")
    .select("*")
    .eq("tenant_id", me.tenant_id)
    .maybeSingle();
  return (data as TenantAgreement) ?? null;
}

/** Does the signed-in tenant still owe a signed agreement? (sections exist and
 *  they haven't signed yet) — used to gate first login. */
export async function tenantNeedsAgreement(): Promise<boolean> {
  const [sections, signed] = await Promise.all([getMyAgreementSections(), myAgreement()]);
  return sections.length > 0 && !signed;
}

/** A tenant's ID documents (raw rows). */
export async function listTenantDocuments(tenantId: string): Promise<TenantDocument[]> {
  const s = await sb();
  const { data } = await s
    .from("tenant_documents")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  return (data ?? []) as TenantDocument[];
}

/** A tenant's documents with short-lived signed view URLs (for display). */
export async function listTenantDocumentsSigned(
  tenantId: string,
): Promise<Array<TenantDocument & { url: string | null }>> {
  const docs = await listTenantDocuments(tenantId);
  return Promise.all(
    docs.map(async (d) => ({ ...d, url: await getKycSignedUrl(d.file_url) })),
  );
}

/** A tenant's signed agreement (staff/admin view, for profile + record). */
export async function getTenantAgreement(tenantId: string): Promise<TenantAgreement | null> {
  const s = await sb();
  const { data } = await s
    .from("tenant_agreements")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as TenantAgreement) ?? null;
}

export async function getMyIssues(): Promise<Issue[]> {
  const s = await sb();
  const { data } = await s
    .from("issues")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Issue[];
}

/** A single payment of the logged-in tenant (RLS-scoped) — for the HRA receipt. */
export async function getMyPayment(id: string): Promise<Payment | null> {
  const s = await sb();
  const { data } = await s.from("payments").select("*").eq("id", id).maybeSingle();
  return (data as Payment) ?? null;
}

/* -------------------------------------------------------- notifications */

export async function getMyNotifications(limit = 20): Promise<AppNotification[]> {
  const s = await sb();
  const { data } = await s
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AppNotification[];
}

/* ---------------------------------------------------------------- food */

export async function getFoodMenu(): Promise<FoodMenuItem[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s.from("food_menu").select("*").eq("pg_id", pid);
  return (data ?? []) as FoodMenuItem[];
}

export interface FoodOptRow {
  date: string;
  meal_type: MealType;
  opted_in: boolean;
}

export async function getMyFoodOpts(from: string, to: string): Promise<FoodOptRow[]> {
  const s = await sb();
  const { data } = await s
    .from("food_opt")
    .select("date, meal_type, opted_in")
    .gte("date", from)
    .lte("date", to);
  return (data ?? []) as FoodOptRow[];
}

/* ------------------------------------------------------------ bookings */

export async function listBookings(): Promise<import("./types").Booking[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s
    .from("bookings")
    .select("*")
    .eq("pg_id", pid)
    .order("created_at", { ascending: false });
  return (data ?? []) as import("./types").Booking[];
}

/** Public PG lookup for the booking page (anon can't read pg_accounts via RLS). */
export async function getPublicPg(
  id: string,
): Promise<{ pg_name: string; location: string; status: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pg_accounts")
    .select("pg_name, location, status")
    .eq("id", id)
    .maybeSingle();
  return (data as { pg_name: string; location: string; status: string }) ?? null;
}

/* ------------------------------------------------------ expenses / P&L */

// Inclusive first day, EXCLUSIVE first-of-next-month (avoids invalid dates like
// 2026-06-31 which Postgres rejects). Use with .gte(from).lt(to).
const monthBounds = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const yy = y ?? 1970;
  const mm = m ?? 1;
  const to = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
  return { from: `${month}-01`, to };
};

export async function listExpenses(month: string): Promise<Expense[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { from, to } = monthBounds(month);
  const { data } = await s
    .from("expenses")
    .select("*")
    .eq("pg_id", pid)
    .gte("date", from)
    .lt("date", to)
    .order("date", { ascending: false });
  return (data ?? []) as Expense[];
}

/** Custom expense categories defined for the active property. */
export async function listExpenseCategories(): Promise<string[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s
    .from("expense_categories")
    .select("name")
    .eq("pg_id", pid)
    .order("name");
  return (data ?? []).map((c) => c.name as string);
}

export async function expenseSummary(month: string) {
  const expenses = await listExpenses(month);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }
  return {
    total,
    byCategory: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export async function pnl(month: string) {
  const s = await sb();
  const pid = await getActiveProperty();
  const { from, to } = monthBounds(month);
  const [{ data: pays }, { data: exps }] = await Promise.all([
    s
      .from("payments")
      .select("total_amount, amount_paid")
      .eq("pg_id", pid)
      .eq("month_for", month),
    s
      .from("expenses")
      .select("amount")
      .eq("pg_id", pid)
      .gte("date", from)
      .lt("date", to),
  ]);
  const billed = ((pays ?? []) as { total_amount: number }[]).reduce((x, p) => x + p.total_amount, 0);
  const collected = ((pays ?? []) as { amount_paid: number }[]).reduce((x, p) => x + p.amount_paid, 0);
  const expenses = ((exps ?? []) as { amount: number }[]).reduce((x, e) => x + e.amount, 0);
  return { billed, collected, expenses, net: collected - expenses };
}

/* ----------------------------------------------------- money model (A2) */

/** The active property's policy row (notice / lock-in / deposit / electricity). */
export async function getActivePolicy(): Promise<PgPolicy | null> {
  const s = await sb();
  const pid = await getActiveProperty();
  if (!pid) return null;
  const { data } = await s.from("pg_policies").select("*").eq("pg_id", pid).maybeSingle();
  return (data as PgPolicy) ?? null;
}

/** Tenant's own policy (read-only) — for the bill / receipt context. */
export async function getMyPolicy(): Promise<PgPolicy | null> {
  const s = await sb();
  const { data } = await s.from("pg_policies").select("*").limit(1).maybeSingle();
  return (data as PgPolicy) ?? null;
}

/** Joining fees for a tenant (admin view). */
export async function getJoiningFees(tenantId: string): Promise<JoiningFee[]> {
  const s = await sb();
  const { data } = await s
    .from("joining_fees")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data ?? []) as JoiningFee[];
}

/** Joining fees for the logged-in tenant. */
export async function getMyJoiningFees(): Promise<JoiningFee[]> {
  const s = await sb();
  const { data } = await s
    .from("joining_fees")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as JoiningFee[];
}

/** All checkout settlements in the active property, newest first (admin). */
export async function listSettlements(): Promise<
  Array<CheckoutSettlement & { tenant_name: string }>
> {
  const s = await sb();
  const pid = await getActiveProperty();
  const { data } = await s
    .from("checkout_settlements")
    .select("*, tenant:tenants(name)")
    .eq("pg_id", pid)
    .order("created_at", { ascending: false });
  type Row = CheckoutSettlement & { tenant: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((x) => ({
    ...x,
    tenant_name: x.tenant?.name ?? "—",
  }));
}

/** A tenant's most recent settlement (admin), if one was already drafted. */
export async function getSettlementForTenant(
  tenantId: string,
): Promise<CheckoutSettlement | null> {
  const s = await sb();
  const { data } = await s
    .from("checkout_settlements")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CheckoutSettlement) ?? null;
}

/** Roommate names only — read via the service client so RLS (which hides other
 *  tenants from a tenant) isn't loosened; we expose just names of same-room peers. */
export async function getRoommateNames(
  roomId: string,
  excludeTenantId: string,
): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("name")
    .eq("room_id", roomId)
    .eq("status", "active")
    .neq("id", excludeTenantId);
  return ((data ?? []) as { name: string }[]).map((t) => t.name);
}
