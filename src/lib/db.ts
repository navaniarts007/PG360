import "server-only";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { getActiveProperty } from "./auth";
import type {
  AppNotification,
  Bed,
  Expense,
  Floor,
  FoodMenuItem,
  Issue,
  MealType,
  Payment,
  PgAccount,
  RateCard,
  Room,
  Tenant,
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

export async function platformStats() {
  const s = await sb();
  const [{ data: pgs }, { count: tenantCount }] = await Promise.all([
    s.from("pg_accounts").select("status, subscription_plan"),
    s.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  const rows = (pgs ?? []) as { status: string; subscription_plan: string }[];
  const active = rows.filter((p) => p.status === "active");
  const mrr = active.reduce(
    (sum, p) =>
      sum +
      (p.subscription_plan === "pro" ? 8000 : p.subscription_plan === "lifetime" ? 0 : 5000),
    0,
  );
  return {
    totalPgs: rows.length,
    activePgs: active.length,
    totalTenants: tenantCount ?? 0,
    mrr,
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

export interface RoomOption {
  id: string;
  label: string;
  full: boolean;
}

export async function getRoomOptions(): Promise<RoomOption[]> {
  const rooms = await listRooms();
  return rooms.map((r) => ({
    id: r.id,
    label: `Room ${r.room_number} · Floor ${r.floor}`,
    full: r.occupied_beds >= r.total_beds,
  }));
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
  const [{ data: rooms }, { data: tenants }, { data: payments }] = await Promise.all([
    s.from("rooms").select("total_beds, occupied_beds").eq("pg_id", pid),
    s.from("tenants").select("id, rent_amount").eq("pg_id", pid).eq("status", "active"),
    s.from("payments").select("tenant_id, total_amount, amount_paid").eq("pg_id", pid).eq("month_for", month),
  ]);
  const r = (rooms ?? []) as { total_beds: number; occupied_beds: number }[];
  const t = (tenants ?? []) as { id: string; rent_amount: number }[];
  const p = (payments ?? []) as { tenant_id: string; total_amount: number; amount_paid: number }[];
  const payByTenant = new Map(p.map((x) => [x.tenant_id, x]));
  const totalBeds = r.reduce((sum, x) => sum + x.total_beds, 0);
  const occupiedBeds = r.reduce((sum, x) => sum + x.occupied_beds, 0);
  const collected = p.reduce((sum, x) => sum + x.amount_paid, 0);
  // billed counts EVERY active tenant — derived from rent when not yet invoiced
  const billed = t.reduce((sum, x) => sum + (payByTenant.get(x.id)?.total_amount ?? x.rent_amount), 0);
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
}

/** Every active tenant's bill for the month — a real invoice row if recorded,
 *  else derived from their rent (so the owner always sees who is due). */
export async function getMonthBill(month: string): Promise<BillRow[]> {
  const s = await sb();
  const pid = await getActiveProperty();
  const [{ data: tenants }, { data: pays }] = await Promise.all([
    s.from("tenants").select("id, name, rent_amount, room:rooms(room_number)").eq("pg_id", pid).eq("status", "active"),
    s.from("payments").select("*").eq("pg_id", pid).eq("month_for", month),
  ]);
  const payByTenant = new Map(((pays ?? []) as Payment[]).map((p) => [p.tenant_id, p]));
  type T = { id: string; name: string; rent_amount: number; room: { room_number: string } | null };
  const order = { due: 0, partial: 1, paid: 2 } as const;
  return ((tenants ?? []) as unknown as T[])
    .map((t) => {
      const p = payByTenant.get(t.id);
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
      };
    })
    .sort((a, b) => order[a.status] - order[b.status] || b.balance - a.balance);
}

export async function listStaff(): Promise<
  { id: string; full_name: string; phone: string | null; role: string }[]
> {
  const s = await sb();
  const pid = await getActiveProperty();
  // members of the active property who are staff (+ the owner admins)
  const { data: members } = await s
    .from("property_members")
    .select("user_id, role")
    .eq("property_id", pid);
  const ids = ((members ?? []) as { user_id: string; role: string }[]).map((m) => m.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await s
    .from("profiles")
    .select("id, full_name, phone, role")
    .in("id", ids);
  return ((profiles ?? []) as { id: string; full_name: string; phone: string | null; role: string }[]).filter(
    (p) => p.role === "staff" || p.role === "admin",
  );
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

export async function getDuePayments(month: string) {
  const all = await getMonthPayments(month);
  return all
    .filter((p) => p.status !== "paid")
    .map((p) => ({
      id: p.id,
      tenant_id: p.tenant_id,
      name: p.name,
      room: p.room,
      balance: p.total_amount - p.amount_paid,
      status: p.status,
    }))
    .sort((a, b) => b.balance - a.balance);
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

/** Bed assigned to the current tenant (if any). */
export async function getMyBed(): Promise<Bed | null> {
  const s = await sb();
  const { data: t } = await s.from("tenants").select("bed_id").limit(1).maybeSingle();
  if (!t || !t.bed_id) return null;
  const { data: bed } = await s.from("beds").select("*").eq("id", t.bed_id).maybeSingle();
  return (bed as Bed) ?? null;
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

export async function getMyIssues(): Promise<Issue[]> {
  const s = await sb();
  const { data } = await s
    .from("issues")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Issue[];
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
