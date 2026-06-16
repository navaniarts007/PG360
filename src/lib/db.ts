import "server-only";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import type {
  AppNotification,
  Expense,
  FoodMenuItem,
  Issue,
  MealType,
  Payment,
  PgAccount,
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
  const { data } = await s.from("rooms").select("*").order("room_number");
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

/* -------------------------------------------------------------- tenants */

type TenantRow = Tenant & { room: { room_number: string; floor: number } | null };

export async function listTenantsWithRoom(): Promise<TenantRow[]> {
  const s = await sb();
  const { data } = await s
    .from("tenants")
    .select("*, room:rooms(room_number, floor)")
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
  const { data } = await s
    .from("tenants")
    .select("id, name, rent_amount, status, room:rooms(room_number)")
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
  const [{ data: rooms }, { count: tenantCount }, { data: payments }] =
    await Promise.all([
      s.from("rooms").select("total_beds, occupied_beds"),
      s.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active"),
      s.from("payments").select("total_amount, amount_paid").eq("month_for", month),
    ]);
  const r = (rooms ?? []) as { total_beds: number; occupied_beds: number }[];
  const p = (payments ?? []) as { total_amount: number; amount_paid: number }[];
  const totalBeds = r.reduce((sum, x) => sum + x.total_beds, 0);
  const occupiedBeds = r.reduce((sum, x) => sum + x.occupied_beds, 0);
  const collected = p.reduce((sum, x) => sum + x.amount_paid, 0);
  const billed = p.reduce((sum, x) => sum + x.total_amount, 0);
  return {
    totalTenants: tenantCount ?? 0,
    roomCount: r.length,
    totalBeds,
    occupiedBeds,
    occupancyPct: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    collected,
    due: Math.max(billed - collected, 0),
    billed,
  };
}

type PaymentRow = Payment & {
  tenant: { name: string; room: { room_number: string } | null } | null;
};

export async function getMonthPayments(
  month: string,
): Promise<Array<Payment & { name: string; room: string }>> {
  const s = await sb();
  const { data } = await s
    .from("payments")
    .select("*, tenant:tenants(name, room:rooms(room_number))")
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
  const { data } = await s
    .from("issues")
    .select("*, tenant:tenants(name, room:rooms(room_number))")
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
  const { data } = await s.from("food_menu").select("*");
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
  const { data } = await s
    .from("bookings")
    .select("*")
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

const monthBounds = (month: string) => ({
  from: `${month}-01`,
  to: `${month}-31`,
});

export async function listExpenses(month: string): Promise<Expense[]> {
  const s = await sb();
  const { from, to } = monthBounds(month);
  const { data } = await s
    .from("expenses")
    .select("*")
    .gte("date", from)
    .lte("date", to)
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
  const { from, to } = monthBounds(month);
  const [{ data: pays }, { data: exps }] = await Promise.all([
    s.from("payments").select("total_amount, amount_paid").eq("month_for", month),
    s.from("expenses").select("amount").gte("date", from).lte("date", to),
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
