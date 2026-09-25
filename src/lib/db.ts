import "server-only";
import { query, queryOne, parseJsonColumn } from "./mysql/client";
import { getActiveProperty, getSession } from "./auth";
import { computeBill } from "./money";
import { currentMonthRent, dueDateFor, firstProRataPeriod } from "./rent";
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
   MySQL-backed data access for the Shanthi Ladies Hostel branch. Postgres
   RLS used to do the pg/tenant scoping automatically on every query; none of
   that exists here. Every function below either:
     (a) filters explicitly by pg_id via getActiveProperty() — the original
         code already did this for most admin/staff reads, so those are a
         mostly mechanical translation, or
     (b) is one of the "getMy*"/tenant-self functions that had NO explicit
         filter at all in the original — those relied entirely on RLS and
         are the highest-risk part of this file. Each one now explicitly
         filters by session.tenant_id / session.pg_id / session.id. See
         deploy/clients/shanthis-ladies-hostel/mysql/RLS_TO_APP_LAYER.md.
   Role gating (who may call a given page at all) happens upstream in
   requireRole() at each route-group layout — same trust boundary the
   Supabase version had; this file's job is correct pg/tenant scoping.
   ========================================================================= */

/* ------------------------------------------------------------- platform */

/** Super-admin-only: every PG account, platform-wide. Callers are gated by
 *  requireRole(["super_admin"]) upstream (see (super-admin) route group). */
export async function listPgAccounts(): Promise<PgAccount[]> {
  return query<PgAccount>(`select * from pg_accounts order by created_at desc`);
}

/** Properties the current admin/staff is a member of. */
export async function listMyProperties(): Promise<PgAccount[]> {
  const session = await getSession();
  const ids = session?.properties.map((p) => p.id) ?? [];
  if (ids.length === 0) return [];
  return query<PgAccount>(
    `select * from pg_accounts where id in (${ids.map(() => "?").join(",")}) order by created_at asc`,
    ids,
  );
}

export async function getPgAccount(id: string): Promise<PgAccount | null> {
  const acct = await queryOne<PgAccount & { settings?: Record<string, unknown> }>(
    `select * from pg_accounts where id = ?`,
    [id],
  );
  if (!acct) return null;
  const settings = parseJsonColumn<Record<string, unknown>>(acct.settings, {});
  acct.settings = settings;
  acct.rules_doc_url = acct.rules_doc_url || (settings.rules_doc_url as string | undefined) || null;
  return acct as PgAccount;
}

/** Recent tenant activity for one PG (super-admin account view). */
export async function getAccountActivity(
  pgId: string,
  limit = 15,
): Promise<Array<TenantEvent & { tenant_name: string }>> {
  const rows = await query<TenantEvent & { tenant_name: string | null }>(
    `select e.id, e.pg_id, e.tenant_id, e.event_type as type, e.detail, e.room_id, e.floor,
            e.created_by, e.created_at, t.name as tenant_name
       from tenant_events e
       left join tenants t on t.id = e.tenant_id
      where e.pg_id = ?
      order by e.created_at desc
      limit ?`,
    [pgId, limit],
  );
  return rows.map((e) => ({ ...e, tenant_name: e.tenant_name ?? "Tenant" }));
}

/** All PG360 invoices across the platform (super-admin), newest first. */
export async function listAllInvoices(): Promise<Array<PlatformInvoice & { pg_name: string }>> {
  const rows = await query<PlatformInvoice & { pg_name: string | null }>(
    `select iv.*, pa.pg_name as pg_name
       from platform_invoices iv
       left join pg_accounts pa on pa.id = iv.pg_id
      order by iv.created_at desc`,
  );
  return rows.map((iv) => ({ ...iv, pg_name: iv.pg_name ?? "—" }));
}

/** Turn a stored file value into a viewable URL. Uploads are stored as
 *  "/api/storage/pg360/<folder>/<filename>" — already a stable, directly
 *  usable path (see src/lib/storage/vps.ts and the upload route); this just
 *  validates the stored value looks like one before handing it to a caller. */
export async function getKycSignedUrl(value: string | null): Promise<string | null> {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  if (!first) return null;
  if (first.startsWith("/api/storage/")) return first;
  if (/^https?:\/\//i.test(first)) return first; // legacy public URL
  return null;
}

/** Get signed viewable URLs for multi-photo KYC fields (comma separated). */
export async function getKycSignedUrls(value: string | null): Promise<string[]> {
  if (!value) return [];
  const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
  const urls = await Promise.all(parts.map((p) => getKycSignedUrl(p)));
  return urls.filter((u): u is string => u !== null);
}

/** Activity log for the active property (admin/staff view). */
export async function listActivity(limit = 200): Promise<ActivityEntry[]> {
  const pid = await getActiveProperty();
  if (!pid) return [];
  return query<ActivityEntry>(
    `select * from activity_log where pg_id = ? order by created_at desc limit ?`,
    [pid, limit],
  );
}

/** Platform-wide activity log (super-admin), with the PG name resolved. */
export async function listAllActivity(
  limit = 300,
): Promise<Array<ActivityEntry & { pg_name: string | null }>> {
  return query<ActivityEntry & { pg_name: string | null }>(
    `select a.*, pa.pg_name as pg_name
       from activity_log a
       left join pg_accounts pa on pa.id = a.pg_id
      order by a.created_at desc
      limit ?`,
    [limit],
  );
}

/** The login email for a user (super-admin account view). */
export async function getAuthEmail(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const row = await queryOne<{ email: string }>(`select email from users where id = ?`, [userId]);
  return row?.email ?? null;
}

/** PG360 subscription invoices for one PG (super-admin / owner read). */
export async function listInvoices(pgId: string): Promise<PlatformInvoice[]> {
  return query<PlatformInvoice>(
    `select * from platform_invoices where pg_id = ? order by created_at desc`,
    [pgId],
  );
}

/** One invoice + its billed PG account (for the printable invoice page). */
export async function getInvoiceWithPg(
  id: string,
): Promise<{ invoice: PlatformInvoice; pg: PgAccount } | null> {
  const invoice = await queryOne<PlatformInvoice>(`select * from platform_invoices where id = ?`, [id]);
  if (!invoice) return null;
  const pg = await queryOne<PgAccount>(`select * from pg_accounts where id = ?`, [invoice.pg_id]);
  if (!pg) return null;
  return { invoice, pg };
}

/** Headline counts for one PG (super-admin account view). */
export async function getAccountStats(pgId: string): Promise<{ tenants: number; rooms: number }> {
  const [t, r] = await Promise.all([
    queryOne<{ n: number }>(
      `select count(*) as n from tenants where pg_id = ? and status = 'active'`,
      [pgId],
    ),
    queryOne<{ n: number }>(`select count(*) as n from rooms where pg_id = ?`, [pgId]),
  ]);
  return { tenants: t?.n ?? 0, rooms: r?.n ?? 0 };
}

/** The active property's money policy, guaranteed non-null (schema defaults when
 *  no row exists yet) — convenient for settings forms. */
export async function getPgPolicy(pgId: string): Promise<PgPolicy> {
  const data = await queryOne<PgPolicy>(`select * from pg_policies where pg_id = ?`, [pgId]);
  if (data) return data;
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
  const [pgs, tenantCount, paid] = await Promise.all([
    query<{ status: string; is_demo: number }>(`select status, is_demo from pg_accounts`),
    queryOne<{ n: number }>(`select count(*) as n from tenants where status = 'active'`),
    query<{ amount: number; tax_percent: number }>(
      `select amount, tax_percent from platform_invoices where status = 'paid'`,
    ),
  ]);
  const active = pgs.filter((p) => p.status === "active");
  const demoPgs = pgs.filter((p) => !!p.is_demo).length;
  const payingPgs = active.filter((p) => !p.is_demo).length;
  const revenue = paid.reduce(
    (sum, iv) => sum + Number(iv.amount) + Math.round((Number(iv.amount) * Number(iv.tax_percent)) / 100),
    0,
  );
  return {
    totalPgs: pgs.length,
    activePgs: active.length,
    demoPgs,
    payingPgs,
    totalTenants: tenantCount?.n ?? 0,
    revenue,
  };
}

/* ---------------------------------------------------------------- rooms */

/** rooms.amenities is a JSON column — see parseJsonColumn's doc comment for
 *  why this can't be trusted to come back as an array without normalizing. */
function normalizeRoom(r: Room): Room {
  return { ...r, amenities: parseJsonColumn<string[]>(r.amenities, []) };
}
function normalizeRoomOrNull(r: Room | null): Room | null {
  return r ? normalizeRoom(r) : null;
}

export async function listRooms(): Promise<Room[]> {
  const pid = await getActiveProperty();
  const rows = await query<Room>(`select * from rooms where pg_id = ? order by room_number`, [pid]);
  return rows.map(normalizeRoom);
}

/* -------------------------------------------------------------- floors */

export async function listFloors(): Promise<Floor[]> {
  const pid = await getActiveProperty();
  return query<Floor>(`select * from floors where pg_id = ? order by sort_order, name`, [pid]);
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
  const floor = await queryOne<Floor>(`select * from floors where id = ?`, [floorId]);
  if (!floor) return null;
  const roomList = (
    await query<Room>(`select * from rooms where floor_id = ? order by room_number`, [floorId])
  ).map(normalizeRoom);
  const roomIds = roomList.map((r) => r.id);
  const [beds, tenants] = await Promise.all([
    roomIds.length
      ? query<Bed>(
          `select * from beds where room_id in (${roomIds.map(() => "?").join(",")}) order by bed_number`,
          roomIds,
        )
      : Promise.resolve([] as Bed[]),
    query<{ id: string; name: string }>(`select id, name from tenants where pg_id = ?`, [floor.pg_id]),
  ]);
  const nameById = new Map(tenants.map((t) => [t.id, t.name]));
  const bedsByRoom = new Map<string, Array<Bed & { tenant_name: string | null }>>();
  for (const b of beds) {
    const list = bedsByRoom.get(b.room_id) ?? [];
    list.push({ ...b, tenant_name: b.current_tenant_id ? nameById.get(b.current_tenant_id) ?? null : null });
    bedsByRoom.set(b.room_id, list);
  }
  return {
    floor,
    rooms: roomList.map((room) => ({ room, beds: bedsByRoom.get(room.id) ?? [] })),
  };
}

/* ----------------------------------------------------- rate cards / beds */

export async function listRateCards(): Promise<RateCard[]> {
  const pid = await getActiveProperty();
  return query<RateCard>(
    `select * from rate_cards where pg_id = ? order by price_per_month desc`,
    [pid],
  );
}

/* ----------------------------------------------- tenant records (events) */

export async function listTenantEvents(tenantId: string): Promise<TenantEvent[]> {
  return query<TenantEvent>(
    `select id, pg_id, tenant_id, event_type as type, detail, room_id, floor, created_by, created_at
       from tenant_events where tenant_id = ? order by created_at desc`,
    [tenantId],
  );
}

/** Recent activity across the active property (for the GVM home feed). */
export async function listRecentEvents(
  limit = 12,
): Promise<Array<TenantEvent & { tenant_name: string }>> {
  const pid = await getActiveProperty();
  const rows = await query<TenantEvent & { tenant_name: string | null }>(
    `select e.id, e.pg_id, e.tenant_id, e.event_type as type, e.detail, e.room_id, e.floor,
            e.created_by, e.created_at, t.name as tenant_name
       from tenant_events e
       left join tenants t on t.id = e.tenant_id
      where e.pg_id = ?
      order by e.created_at desc
      limit ?`,
    [pid, limit],
  );
  return rows.map((e) => ({ ...e, tenant_name: e.tenant_name ?? "Tenant" }));
}

/** Checked-out tenants (the "Vacated Master") for the active property. */
export async function listVacated(): Promise<Array<Tenant & { room_number: string | null }>> {
  const pid = await getActiveProperty();
  const rows = await query<Tenant & { room_number: string | null }>(
    `select t.*, r.room_number as room_number
       from tenants t
       left join rooms r on r.id = t.room_id
      where t.pg_id = ? and t.status = 'checked_out'
      order by t.checkout_date desc`,
    [pid],
  );
  return rows;
}

/** How many beds currently price off each rate card (for the Pricing page). */
export async function rateCardBedCounts(): Promise<Record<string, number>> {
  const pid = await getActiveProperty();
  const rows = await query<{ rate_card_id: string | null }>(
    `select rate_card_id from beds where pg_id = ?`,
    [pid],
  );
  const counts: Record<string, number> = {};
  for (const b of rows) {
    if (b.rate_card_id) counts[b.rate_card_id] = (counts[b.rate_card_id] ?? 0) + 1;
  }
  return counts;
}

/* ------------------------------------------------------------- wifi master */

export async function listWifiNetworks(): Promise<WifiNetwork[]> {
  const pid = await getActiveProperty();
  return query<WifiNetwork>(`select * from wifi_networks where pg_id = ? order by ssid`, [pid]);
}

export interface RoomBeds {
  room: Room;
  beds: Array<Bed & { tenant_name: string | null }>;
}

/** Bed-level occupancy grouped by room (the view Bangalore owners want). */
export async function listBedsByRoom(): Promise<RoomBeds[]> {
  const pid = await getActiveProperty();
  const [beds, rooms, tenants] = await Promise.all([
    query<Bed>(`select * from beds where pg_id = ? order by bed_number`, [pid]),
    listRooms(),
    query<{ id: string; name: string }>(`select id, name from tenants where pg_id = ?`, [pid]),
  ]);
  const nameById = new Map(tenants.map((t) => [t.id, t.name]));
  const bedsByRoom = new Map<string, Array<Bed & { tenant_name: string | null }>>();
  for (const b of beds) {
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
  const pid = await getActiveProperty();
  const beds = await query<{
    id: string;
    bed_number: string;
    price_per_month: number;
    room_id: string;
    status: "vacant" | "occupied";
  }>(
    `select id, bed_number, price_per_month, room_id, status from beds where pg_id = ? order by bed_number`,
    [pid],
  );
  const rooms = await listRooms();
  const roomNo = new Map(rooms.map((r) => [r.id, r.room_number]));
  return beds.map((b) => ({
    id: b.id,
    label: `Room ${roomNo.get(b.room_id) ?? "?"} · Bed ${b.bed_number} · ₹${Number(b.price_per_month).toLocaleString("en-IN")}/mo`,
    price: Number(b.price_per_month),
    room_id: b.room_id,
    status: b.status,
  }));
}

/* -------------------------------------------------------------- tenants */

type TenantRow = Tenant & { room: { room_number: string; floor: number } | null };

/** Tenant ids that have paid anything at all (any month). Once a tenant has
 *  paid, they're no longer treated as a "fresh first-month" partial — the
 *  balance is tracked on the recorded bill instead. An unpaid "due" bill does
 *  NOT count, so a never-collected first month still shows its full amount. */
export async function paidTenantIds(): Promise<Set<string>> {
  const pid = await getActiveProperty();
  if (!pid) return new Set();
  const rows = await query<{ tenant_id: string }>(
    `select tenant_id from payments where pg_id = ? and amount_paid > 0`,
    [pid],
  );
  return new Set(rows.map((p) => p.tenant_id));
}

/** Total joining/admission fees per tenant for the active property. */
export async function joiningFeeTotals(): Promise<Record<string, number>> {
  const pid = await getActiveProperty();
  const rows = await query<{ tenant_id: string; amount: number }>(
    `select tenant_id, amount from joining_fees where pg_id = ?`,
    [pid],
  );
  const map: Record<string, number> = {};
  for (const r of rows) map[r.tenant_id] = (map[r.tenant_id] ?? 0) + Number(r.amount);
  return map;
}

export async function listTenantsWithRoom(): Promise<TenantRow[]> {
  const pid = await getActiveProperty();
  const rows = await query<Tenant & { room_number: string | null; floor: number | null }>(
    `select t.*, r.room_number as room_number, r.floor as floor
       from tenants t
       left join rooms r on r.id = t.room_id
      where t.pg_id = ?
      order by (t.status = 'checked_out') asc, t.created_at desc`,
    [pid],
  );
  return rows.map((t) => {
    const { room_number, floor, ...rest } = t;
    return {
      ...rest,
      room: room_number != null ? { room_number, floor: floor ?? 0 } : null,
    } as TenantRow;
  });
}

/** The bill the record-payment dialog should open pre-filled with for a tenant:
 *  their uncollected first month (pro-rata rent + deposit, filed under the
 *  check-in month) if still pending, else the regular full month. */
export interface BillSuggestion {
  baseRent: number;
  days: number;
  deposit: number;
  month: string; // YYYY-MM the bill is filed under
  proRata: boolean;
}

export interface PayTenant {
  id: string;
  name: string;
  rent_amount: number;
  room_label: string;
  checkin_date: string;
  rent_due_day: number;
  security_deposit: number;
  stay_type: "monthly" | "daily";
  suggested: BillSuggestion;
}

export async function getPayTenants(): Promise<PayTenant[]> {
  const pid = await getActiveProperty();
  const [rows, paidIds] = await Promise.all([
    query<{
      id: string;
      name: string;
      rent_amount: number;
      security_deposit: number;
      checkin_date: string;
      rent_due_day: number;
      stay_type: "monthly" | "daily";
      room_number: string | null;
    }>(
      `select t.id, t.name, t.rent_amount, t.security_deposit, t.checkin_date, t.rent_due_day,
              t.stay_type, r.room_number as room_number
         from tenants t
         left join rooms r on r.id = t.room_id
        where t.pg_id = ? and t.status = 'active'`,
      [pid],
    ),
    paidTenantIds(),
  ]);
  const nowMonth = new Date().toISOString().slice(0, 7);
  return rows.map((t) => {
    const checkinMonth = t.checkin_date.slice(0, 7);
    const pending = !paidIds.has(t.id);
    const cr = currentMonthRent(t, { securityDeposit: t.security_deposit, firstMonthPending: pending });
    const suggested: BillSuggestion = cr.proRata
      ? { baseRent: cr.rent, days: cr.days || 30, deposit: cr.deposit, month: checkinMonth, proRata: true }
      : { baseRent: t.rent_amount, days: 30, deposit: 0, month: nowMonth, proRata: false };
    return {
      id: t.id,
      name: t.name,
      rent_amount: t.rent_amount,
      room_label: t.room_number ? `Room ${t.room_number}` : "Unassigned",
      checkin_date: t.checkin_date,
      rent_due_day: t.rent_due_day,
      security_deposit: t.security_deposit,
      stay_type: t.stay_type,
      suggested,
    };
  });
}

export async function getTenantDetail(id: string): Promise<{
  tenant: Tenant;
  room: Room | null;
  payments: Payment[];
} | null> {
  const tenant = await queryOne<Tenant>(`select * from tenants where id = ?`, [id]);
  if (!tenant) return null;
  const [room, payments] = await Promise.all([
    tenant.room_id ? queryOne<Room>(`select * from rooms where id = ?`, [tenant.room_id]) : Promise.resolve(null),
    query<Payment>(`select * from payments where tenant_id = ? order by month_for desc`, [id]),
  ]);
  return { tenant, room: normalizeRoomOrNull(room), payments };
}

/* ------------------------------------------------------------- payments */

export async function adminKpis(month: string) {
  const pid = await getActiveProperty();
  const [rooms, tenants, payments, pg] = await Promise.all([
    query<{ total_beds: number; occupied_beds: number }>(
      `select total_beds, occupied_beds from rooms where pg_id = ?`,
      [pid],
    ),
    query<{
      id: string;
      rent_amount: number;
      checkin_date: string;
      food_opt_out: number;
      stay_type: "monthly" | "daily";
    }>(
      `select id, rent_amount, checkin_date, food_opt_out, stay_type
         from tenants where pg_id = ? and status = 'active'`,
      [pid],
    ),
    query<{ tenant_id: string; total_amount: number; amount_paid: number }>(
      `select tenant_id, total_amount, amount_paid from payments where pg_id = ? and month_for = ?`,
      [pid, month],
    ),
    queryOne<{ food_opt_out_deduction: number }>(
      `select food_opt_out_deduction from pg_accounts where id = ?`,
      [pid],
    ),
  ]);
  const foodDeduction = pg?.food_opt_out_deduction ?? 0;
  const payByTenant = new Map(payments.map((x) => [x.tenant_id, x]));
  const totalBeds = rooms.reduce((sum, x) => sum + x.total_beds, 0);
  const occupiedBeds = rooms.reduce((sum, x) => sum + x.occupied_beds, 0);
  const collected = payments.reduce((sum, x) => sum + Number(x.amount_paid), 0);
  const billed = tenants.reduce((sum, x) => {
    const invoiced = payByTenant.get(x.id)?.total_amount;
    if (invoiced != null) return sum + Number(invoiced);
    if (x.stay_type === "daily") {
      return sum + (x.checkin_date.slice(0, 7) === month ? x.rent_amount : 0);
    }
    return (
      sum +
      computeBill({
        pricePerMonth: x.rent_amount,
        checkinISO: x.checkin_date,
        month,
        foodOptOut: !!x.food_opt_out,
        foodOptOutDeduction: foodDeduction,
      }).total
    );
  }, 0);
  return {
    totalTenants: tenants.length,
    roomCount: rooms.length,
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
  rent_amount: number;
  security_deposit: number;
  stay_type: "monthly" | "daily";
  rent_due_day: number;
  checkin_date: string;
  due_date: string;
  is_upcoming: boolean;
}

/** Every active tenant's bill for the month — a real invoice row if recorded,
 *  else derived from their rent (so the owner always sees who is due). */
export async function getMonthBill(month: string): Promise<BillRow[]> {
  const pid = await getActiveProperty();
  const [tenants, pays, pg] = await Promise.all([
    query<{
      id: string;
      name: string;
      rent_amount: number;
      security_deposit: number;
      checkin_date: string;
      rent_due_day: number;
      food_opt_out: number;
      stay_type: "monthly" | "daily";
      daily_rate: number | null;
      stay_days: number | null;
      room_number: string | null;
    }>(
      `select t.id, t.name, t.rent_amount, t.security_deposit, t.checkin_date, t.rent_due_day,
              t.food_opt_out, t.stay_type, t.daily_rate, t.stay_days, r.room_number as room_number
         from tenants t
         left join rooms r on r.id = t.room_id
        where t.pg_id = ? and t.status = 'active'`,
      [pid],
    ),
    query<Payment>(`select * from payments where pg_id = ? and month_for = ?`, [pid, month]),
    queryOne<{ food_opt_out_deduction: number }>(
      `select food_opt_out_deduction from pg_accounts where id = ?`,
      [pid],
    ),
  ]);
  const foodDeduction = pg?.food_opt_out_deduction ?? 0;
  const payByTenant = new Map(pays.map((p) => [p.tenant_id, p]));
  const todayISO = new Date().toISOString().slice(0, 10);
  const order = { due: 0, partial: 1, paid: 2 } as const;
  return tenants
    .map((t): BillRow | null => {
      const p = payByTenant.get(t.id);

      if (t.stay_type === "daily") {
        if (t.checkin_date.slice(0, 7) !== month) return null;
        const total = p?.total_amount ?? t.rent_amount;
        const paid = p?.amount_paid ?? 0;
        return {
          tenant_id: t.id,
          name: t.name,
          room: t.room_number ?? "—",
          paymentId: p?.id ?? null,
          total: Number(total),
          paid: Number(paid),
          balance: Math.max(Number(total) - Number(paid), 0),
          status: (p?.status ?? "due") as BillRow["status"],
          verified: !!p?.verified,
          payment_mode: p?.payment_mode ?? null,
          screenshot_url: p?.payment_screenshot_url ?? null,
          rent_amount: t.rent_amount,
          security_deposit: t.security_deposit,
          stay_type: t.stay_type,
          rent_due_day: t.rent_due_day,
          checkin_date: t.checkin_date,
          due_date: t.checkin_date,
          is_upcoming: false,
        };
      }

      const derived = computeBill({
        pricePerMonth: t.rent_amount,
        checkinISO: t.checkin_date,
        month,
        foodOptOut: !!t.food_opt_out,
        foodOptOutDeduction: foodDeduction,
      });
      const dueDate = dueDateFor(month, t.rent_due_day);
      const total = p?.total_amount ?? derived.total;
      const paid = p?.amount_paid ?? 0;
      const todayMonth = todayISO.slice(0, 7);
      const isUpcoming = !p && month >= todayMonth;
      return {
        tenant_id: t.id,
        name: t.name,
        room: t.room_number ?? "—",
        paymentId: p?.id ?? null,
        total: Number(total),
        paid: Number(paid),
        balance: Math.max(Number(total) - Number(paid), 0),
        status: (p?.status ?? "due") as BillRow["status"],
        verified: !!p?.verified,
        payment_mode: p?.payment_mode ?? null,
        screenshot_url: p?.payment_screenshot_url ?? null,
        rent_amount: t.rent_amount,
        security_deposit: t.security_deposit,
        stay_type: t.stay_type,
        rent_due_day: t.rent_due_day,
        checkin_date: t.checkin_date,
        due_date: dueDate,
        is_upcoming: isUpcoming,
      };
    })
    .filter((r): r is BillRow => r !== null)
    .sort((a, b) => {
      if (a.is_upcoming !== b.is_upcoming) return a.is_upcoming ? 1 : -1;
      return order[a.status] - order[b.status] || b.balance - a.balance;
    });
}

export interface EarlyPartialDue {
  tenant_id: string;
  name: string;
  room: string;
  month_for: string;
  rent: number;
  deposit: number;
  amount: number;
  days: number;
  checkin_date: string;
}

/** Uncollected first-month partials from BEFORE the current month — a mid-month
 *  join whose pro-rata first month was never recorded and has since rolled off
 *  the current-month bill. Lets the owner still collect it. */
export async function pendingFirstMonthPartials(currentMonth: string): Promise<EarlyPartialDue[]> {
  const pid = await getActiveProperty();
  if (!pid) return [];
  const [tenants, paidIds] = await Promise.all([
    query<{
      id: string;
      name: string;
      rent_amount: number;
      security_deposit: number;
      checkin_date: string;
      rent_due_day: number;
      stay_type: "monthly" | "daily";
      room_number: string | null;
    }>(
      `select t.id, t.name, t.rent_amount, t.security_deposit, t.checkin_date, t.rent_due_day,
              t.stay_type, r.room_number as room_number
         from tenants t
         left join rooms r on r.id = t.room_id
        where t.pg_id = ? and t.status = 'active'`,
      [pid],
    ),
    paidTenantIds(),
  ]);
  const out: EarlyPartialDue[] = [];
  for (const t of tenants) {
    if (t.stay_type === "daily") continue;
    const checkinMonth = t.checkin_date.slice(0, 7);
    if (checkinMonth >= currentMonth) continue;
    if (paidIds.has(t.id)) continue;
    const fp = firstProRataPeriod(t.checkin_date, t.rent_due_day, t.rent_amount, new Map());
    if (!fp.isProRata) continue;
    const deposit = t.security_deposit ?? 0;
    out.push({
      tenant_id: t.id,
      name: t.name,
      room: t.room_number ?? "—",
      month_for: checkinMonth,
      rent: fp.amount,
      deposit,
      amount: fp.amount + deposit,
      days: fp.days,
      checkin_date: t.checkin_date,
    });
  }
  return out;
}

export async function listStaff(): Promise<
  { id: string; full_name: string; phone: string | null; role: string; permissions: import("./types").StaffPermissions | null }[]
> {
  const pid = await getActiveProperty();
  if (!pid) return [];
  const rows = await query<{
    id: string;
    full_name: string;
    phone: string | null;
    role: string;
    permissions: import("./types").StaffPermissions | null;
  }>(
    `select p.id, p.full_name, p.phone, p.role, p.permissions
       from property_members pm
       join profiles p on p.id = pm.user_id
      where pm.property_id = ? and p.role in ('staff', 'admin')`,
    [pid],
  );
  return rows;
}

export async function getMonthPayments(
  month: string,
): Promise<Array<Payment & { name: string; room: string }>> {
  const pid = await getActiveProperty();
  const rows = await query<Payment & { name: string | null; room_number: string | null }>(
    `select p.*, t.name as name, r.room_number as room_number
       from payments p
       left join tenants t on t.id = p.tenant_id
       left join rooms r on r.id = t.room_id
      where p.pg_id = ? and p.month_for = ?`,
    [pid, month],
  );
  return rows.map((p) => {
    const { name, room_number, ...rest } = p;
    return { ...rest, name: name ?? "—", room: room_number ?? "—" };
  });
}

/* --------------------------------------------------------------- issues */

export async function listIssuesWithTenant(): Promise<
  Array<Issue & { tenant_name: string; room_number: string | null }>
> {
  const pid = await getActiveProperty();
  const rows = await query<Issue & { tenant_name: string | null; room_number: string | null }>(
    `select i.*, t.name as tenant_name, r.room_number as room_number
       from issues i
       left join tenants t on t.id = i.tenant_id
       left join rooms r on r.id = t.room_id
      where i.pg_id = ?
      order by i.created_at desc`,
    [pid],
  );
  return rows.map((i) => ({ ...i, tenant_name: i.tenant_name ?? "Tenant" }));
}

/* ----------------------------------------------------------- tenant self */
// Every function below was previously scoped ONLY by Postgres RLS with zero
// explicit filter in the code (tenants_self_read / payments_self_read /
// notif_self_read / etc.). All now filter explicitly by the caller's own
// session.tenant_id / session.pg_id / session.id — see RLS_TO_APP_LAYER.md.

export async function getMyTenant(): Promise<{
  tenant: Tenant;
  room: Room | null;
} | null> {
  const session = await getSession();
  if (!session) return null;
  const tenant = await queryOne<Tenant>(`select * from tenants where user_id = ? limit 1`, [session.id]);
  if (!tenant) return null;
  const room = tenant.room_id
    ? await queryOne<Room>(`select * from rooms where id = ?`, [tenant.room_id])
    : null;
  return { tenant, room: normalizeRoomOrNull(room) };
}

export async function getMyPg(): Promise<PgAccount | null> {
  const session = await getSession();
  if (!session?.pg_id) return null;
  return queryOne<PgAccount>(`select * from pg_accounts where id = ?`, [session.pg_id]);
}

export async function getMyPayments(): Promise<Payment[]> {
  const session = await getSession();
  if (!session?.tenant_id) return [];
  return query<Payment>(`select * from payments where tenant_id = ? order by month_for desc`, [
    session.tenant_id,
  ]);
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
    dueDate = t.checkin_date;
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
  const curMonth = new Date().toISOString().slice(0, 7);
  const overdue = month < curMonth;
  return { balance, total, dueDate, overdue };
}

/* ----------------------------------------------------- agreements -------- */

/** The PG's ordered policy sections (staff/admin view). */
export async function listAgreementSections(pgId: string): Promise<AgreementSection[]> {
  return query<AgreementSection>(
    `select * from agreement_sections where pg_id = ? order by idx asc`,
    [pgId],
  );
}

/** The signed-in tenant's PG policy sections (for the agreement screen). */
export async function getMyAgreementSections(): Promise<AgreementSection[]> {
  const session = await getSession();
  if (!session?.pg_id) return [];
  return query<AgreementSection>(
    `select * from agreement_sections where pg_id = ? order by idx asc`,
    [session.pg_id],
  );
}

/** The signed-in tenant's agreement row, if they've signed. */
export async function myAgreement(): Promise<TenantAgreement | null> {
  const me = await getSession();
  if (!me?.tenant_id) return null;
  return queryOne<TenantAgreement>(`select * from tenant_agreements where tenant_id = ?`, [
    me.tenant_id,
  ]);
}

/** Does the signed-in tenant still owe a signed agreement? (sections exist and
 *  they haven't signed yet) — used to gate first login. */
export async function tenantNeedsAgreement(): Promise<boolean> {
  const [sections, signed] = await Promise.all([getMyAgreementSections(), myAgreement()]);
  return sections.length > 0 && !signed;
}

/** A tenant's ID documents (raw rows). */
export async function listTenantDocuments(tenantId: string): Promise<TenantDocument[]> {
  return query<TenantDocument>(
    `select * from tenant_documents where tenant_id = ? order by created_at asc`,
    [tenantId],
  );
}

/** A tenant's documents with short-lived signed view URLs (for display). */
export async function listTenantDocumentsSigned(
  tenantId: string,
): Promise<Array<TenantDocument & { url: string | null }>> {
  const docs = await listTenantDocuments(tenantId);
  return Promise.all(docs.map(async (d) => ({ ...d, url: await getKycSignedUrl(d.file_url) })));
}

/** A tenant's signed agreement (staff/admin view, for profile + record). */
export async function getTenantAgreement(tenantId: string): Promise<TenantAgreement | null> {
  return queryOne<TenantAgreement>(`select * from tenant_agreements where tenant_id = ?`, [tenantId]);
}

/** Every signed agreement for a property, keyed by tenant_id — one query for
 *  a whole tenant list instead of one per row. */
export async function listTenantAgreementsByTenant(pgId: string): Promise<Record<string, TenantAgreement>> {
  const rows = await query<TenantAgreement>(`select * from tenant_agreements where pg_id = ?`, [pgId]);
  return Object.fromEntries(rows.map((r) => [r.tenant_id, r]));
}

export async function getMyIssues(): Promise<Issue[]> {
  const session = await getSession();
  if (!session?.tenant_id) return [];
  return query<Issue>(`select * from issues where tenant_id = ? order by created_at desc`, [
    session.tenant_id,
  ]);
}

/** A single payment of the logged-in tenant — for the HRA receipt. Scoped to
 *  the caller's own tenant_id so a guessed id can't fetch someone else's. */
export async function getMyPayment(id: string): Promise<Payment | null> {
  const session = await getSession();
  if (!session?.tenant_id) return null;
  return queryOne<Payment>(`select * from payments where id = ? and tenant_id = ?`, [
    id,
    session.tenant_id,
  ]);
}

/** A payment + its tenant + its PG, scoped by the caller's actual access —
 *  a tenant sees only their own, admin/staff only their active property's,
 *  super_admin unrestricted (matches the global bypass elsewhere). Backs the
 *  one shared /receipt/[paymentId] page both tenant and admin/staff print
 *  from, so there's exactly one receipt format, not two. */
export async function getPaymentForReceipt(
  id: string,
): Promise<{ payment: Payment; tenant: Tenant; pg: PgAccount } | null> {
  const session = await getSession();
  if (!session) return null;

  let payment: Payment | null = null;
  if (session.role === "tenant") {
    if (!session.tenant_id) return null;
    payment = await queryOne<Payment>(`select * from payments where id = ? and tenant_id = ?`, [
      id,
      session.tenant_id,
    ]);
  } else if (session.role === "admin" || session.role === "staff") {
    const pid = await getActiveProperty();
    if (!pid) return null;
    payment = await queryOne<Payment>(`select * from payments where id = ? and pg_id = ?`, [id, pid]);
  } else if (session.role === "super_admin") {
    payment = await queryOne<Payment>(`select * from payments where id = ?`, [id]);
  }
  if (!payment) return null;

  const [tenant, pg] = await Promise.all([
    queryOne<Tenant>(`select * from tenants where id = ?`, [payment.tenant_id]),
    queryOne<PgAccount>(`select * from pg_accounts where id = ?`, [payment.pg_id]),
  ]);
  if (!tenant || !pg) return null;
  return { payment, tenant, pg };
}

/* -------------------------------------------------------- notifications */

export async function getMyNotifications(limit = 20): Promise<AppNotification[]> {
  const session = await getSession();
  if (!session) return [];
  return query<AppNotification>(
    `select * from notifications where recipient_id = ? order by created_at desc limit ?`,
    [session.id, limit],
  );
}

/* ---------------------------------------------------------------- food */

export async function getFoodMenu(): Promise<FoodMenuItem[]> {
  const pid = await getActiveProperty();
  return query<FoodMenuItem>(`select * from food_menu where pg_id = ?`, [pid]);
}

export interface FoodOptRow {
  date: string;
  meal_type: MealType;
  opted_in: boolean;
}

export async function getMyFoodOpts(from: string, to: string): Promise<FoodOptRow[]> {
  const session = await getSession();
  if (!session?.tenant_id) return [];
  const rows = await query<{ opt_date: string; meal_type: MealType; opted_in: number }>(
    `select opt_date, meal_type, opted_in
       from food_opt
      where tenant_id = ? and opt_date >= ? and opt_date <= ?`,
    [session.tenant_id, from, to],
  );
  return rows.map((r) => ({ date: r.opt_date, meal_type: r.meal_type, opted_in: !!r.opted_in }));
}

/* ------------------------------------------------------------ bookings */

export async function listBookings(): Promise<import("./types").Booking[]> {
  const pid = await getActiveProperty();
  return query<import("./types").Booking>(
    `select * from bookings where pg_id = ? order by created_at desc`,
    [pid],
  );
}

/** Public PG lookup for the booking page — intentionally unauthenticated
 *  (no session check), matching the original "anon can read via the admin
 *  client" design for this one public-facing page. */
export async function getPublicPg(
  id: string,
): Promise<{ pg_name: string; location: string; status: string } | null> {
  return queryOne<{ pg_name: string; location: string; status: string }>(
    `select pg_name, location, status from pg_accounts where id = ?`,
    [id],
  );
}

/* ------------------------------------------------------ expenses / P&L */

// Inclusive first day, EXCLUSIVE first-of-next-month (avoids invalid dates like
// 2026-06-31). Use with date >= from AND date < to.
const monthBounds = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const yy = y ?? 1970;
  const mm = m ?? 1;
  const to = mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
  return { from: `${month}-01`, to };
};

export async function listExpenses(month: string): Promise<Expense[]> {
  const pid = await getActiveProperty();
  const { from, to } = monthBounds(month);
  return query<Expense>(
    `select id, pg_id, category, subcategory, amount, expense_date as date, description, added_by, created_at
       from expenses
      where pg_id = ? and expense_date >= ? and expense_date < ?
      order by expense_date desc`,
    [pid, from, to],
  );
}

export interface ExpenseCat {
  name: string;
  parent: string;
}

/** Custom expense categories + sub-categories defined for the active property. */
export async function listExpenseCategories(): Promise<ExpenseCat[]> {
  const pid = await getActiveProperty();
  const rows = await query<{ name: string; parent: string | null }>(
    `select name, parent from expense_categories where pg_id = ? order by name`,
    [pid],
  );
  return rows.map((c) => ({ name: c.name, parent: c.parent ?? "" }));
}

export async function expenseSummary(month: string) {
  const expenses = await listExpenses(month);
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
  }
  return {
    total,
    byCategory: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export interface ExpenseAnalytics {
  monthly: { month: string; label: string; total: number }[];
  categories: { category: string; amount: number }[];
  perMonthCategory: Array<Record<string, string | number>>;
  topCats: string[];
  thisMonth: number;
  prevMonth: number;
  avg: number;
  windowTotal: number;
  topCategory: { category: string; amount: number } | null;
  count: number;
}

/** Rolling expense analytics for the active property over the last `monthsBack`
 *  months: monthly totals, category totals, and a per-month category breakdown
 *  (top 5 categories + "other"). Powers the expenses dashboard/charts. */
export async function expenseAnalytics(monthsBack = 6): Promise<ExpenseAnalytics> {
  const pid = await getActiveProperty();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  const startISO = start.toISOString().slice(0, 10);
  const exps = await query<{ category: string; amount: number; expense_date: string }>(
    `select category, amount, expense_date from expenses where pg_id = ? and expense_date >= ?`,
    [pid, startISO],
  );

  const months: string[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1) + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const shortLabel = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y!, (mo ?? 1) - 1, 1).toLocaleDateString("en-IN", { month: "short" });
  };

  const monthTotals = new Map(months.map((m) => [m, 0]));
  const catTotals = new Map<string, number>();
  const perMC = new Map(months.map((m) => [m, new Map<string, number>()]));
  for (const e of exps) {
    const m = e.expense_date.slice(0, 7);
    if (!monthTotals.has(m)) continue;
    monthTotals.set(m, (monthTotals.get(m) ?? 0) + Number(e.amount));
    catTotals.set(e.category, (catTotals.get(e.category) ?? 0) + Number(e.amount));
    const mm = perMC.get(m)!;
    mm.set(e.category, (mm.get(e.category) ?? 0) + Number(e.amount));
  }

  const categories = [...catTotals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  const topCats = categories.slice(0, 5).map((c) => c.category);

  const perMonthCategory = months.map((m) => {
    const row: Record<string, string | number> = { label: shortLabel(m) };
    const mm = perMC.get(m)!;
    let other = 0;
    for (const [c, v] of mm) {
      if (topCats.includes(c)) row[c] = v;
      else other += v;
    }
    if (other) row["other"] = Number(row["other"] ?? 0) + other;
    for (const c of topCats) if (!(c in row)) row[c] = 0;
    return row;
  });

  const monthly = months.map((m) => ({ month: m, label: shortLabel(m), total: monthTotals.get(m) ?? 0 }));
  const windowTotal = monthly.reduce((s2, x) => s2 + x.total, 0);
  return {
    monthly,
    categories,
    perMonthCategory,
    topCats,
    thisMonth: monthTotals.get(months[monthsBack - 1]!) ?? 0,
    prevMonth: monthTotals.get(months[monthsBack - 2]!) ?? 0,
    avg: Math.round(windowTotal / monthsBack),
    windowTotal,
    topCategory: categories[0] ?? null,
    count: exps.length,
  };
}

export async function pnl(month: string) {
  const pid = await getActiveProperty();
  const { from, to } = monthBounds(month);
  const [pays, exps] = await Promise.all([
    query<{ total_amount: number; amount_paid: number }>(
      `select total_amount, amount_paid from payments where pg_id = ? and month_for = ?`,
      [pid, month],
    ),
    query<{ amount: number }>(
      `select amount from expenses where pg_id = ? and expense_date >= ? and expense_date < ?`,
      [pid, from, to],
    ),
  ]);
  const billed = pays.reduce((x, p) => x + Number(p.total_amount), 0);
  const collected = pays.reduce((x, p) => x + Number(p.amount_paid), 0);
  const expenses = exps.reduce((x, e) => x + Number(e.amount), 0);
  return { billed, collected, expenses, net: collected - expenses };
}

/* ----------------------------------------------------- money model (A2) */

/** The active property's policy row (notice / lock-in / deposit / electricity). */
export async function getActivePolicy(): Promise<PgPolicy | null> {
  const pid = await getActiveProperty();
  if (!pid) return null;
  return queryOne<PgPolicy>(`select * from pg_policies where pg_id = ?`, [pid]);
}

/** Tenant's own policy (read-only) — for the bill / receipt context. */
export async function getMyPolicy(): Promise<PgPolicy | null> {
  const session = await getSession();
  if (!session?.pg_id) return null;
  return queryOne<PgPolicy>(`select * from pg_policies where pg_id = ?`, [session.pg_id]);
}

/** Joining fees for a tenant (admin view). */
export async function getJoiningFees(tenantId: string): Promise<JoiningFee[]> {
  return query<JoiningFee>(
    `select * from joining_fees where tenant_id = ? order by created_at desc`,
    [tenantId],
  );
}

/** Joining fees for the logged-in tenant. */
export async function getMyJoiningFees(): Promise<JoiningFee[]> {
  const session = await getSession();
  if (!session?.tenant_id) return [];
  return query<JoiningFee>(
    `select * from joining_fees where tenant_id = ? order by created_at desc`,
    [session.tenant_id],
  );
}

/** All checkout settlements in the active property, newest first (admin). */
export async function listSettlements(): Promise<Array<CheckoutSettlement & { tenant_name: string }>> {
  const pid = await getActiveProperty();
  const rows = await query<CheckoutSettlement & { tenant_name: string | null }>(
    `select cs.*, t.name as tenant_name
       from checkout_settlements cs
       left join tenants t on t.id = cs.tenant_id
      where cs.pg_id = ?
      order by cs.created_at desc`,
    [pid],
  );
  return rows.map((x) => ({ ...x, tenant_name: x.tenant_name ?? "—" }));
}

/** A tenant's most recent settlement (admin), if one was already drafted. */
export async function getSettlementForTenant(tenantId: string): Promise<CheckoutSettlement | null> {
  return queryOne<CheckoutSettlement>(
    `select * from checkout_settlements where tenant_id = ? order by created_at desc limit 1`,
    [tenantId],
  );
}

/** Roommate names only — deliberately narrow (just names of same-room peers),
 *  same restriction the original "read via the service client, not loosened
 *  RLS" comment intended. */
export async function getRoommateNames(roomId: string, excludeTenantId: string): Promise<string[]> {
  const rows = await query<{ name: string }>(
    `select name from tenants where room_id = ? and status = 'active' and id <> ?`,
    [roomId, excludeTenantId],
  );
  return rows.map((t) => t.name);
}
