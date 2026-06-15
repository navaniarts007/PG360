import {
  DEMO_PASSWORD,
  demoIssues,
  demoPaymentHistory,
  demoPayments,
  demoPgAccounts,
  demoProfiles,
  demoRooms,
  demoTenants,
} from "./demo-data";
import type {
  Issue,
  Payment,
  PgAccount,
  Profile,
  Room,
  Tenant,
} from "./types";

/* =========================================================================
   In-memory demo store. Survives HMR in dev via globalThis. This is the
   DEMO backend; the real backend is Supabase (see /lib/supabase + migrations).
   ========================================================================= */

interface DB {
  profiles: Profile[];
  pgAccounts: PgAccount[];
  rooms: Room[];
  tenants: Tenant[];
  payments: Payment[];
  issues: Issue[];
}

function seed(): DB {
  return {
    profiles: structuredClone(demoProfiles),
    pgAccounts: structuredClone(demoPgAccounts),
    rooms: structuredClone(demoRooms),
    tenants: structuredClone(demoTenants),
    payments: structuredClone([...demoPayments, ...demoPaymentHistory]),
    issues: structuredClone(demoIssues),
  };
}

const g = globalThis as unknown as { __pg360_db?: DB };
const db: DB = (g.__pg360_db ??= seed());

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

/* ----------------------------- profiles / auth ----------------------------- */

export function findProfileByEmail(email: string): Profile | undefined {
  return db.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
}

export function verifyCredentials(email: string, password: string): Profile | null {
  const p = findProfileByEmail(email);
  if (!p) return null;
  return p.password === password ? p : null;
}

export function getProfile(id: string): Profile | undefined {
  return db.profiles.find((p) => p.id === id);
}

/* ------------------------------ pg accounts ------------------------------ */

export function listPgAccounts(): PgAccount[] {
  return [...db.pgAccounts].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getPgAccount(id: string): PgAccount | undefined {
  return db.pgAccounts.find((p) => p.id === id);
}

export function createPgAccount(input: {
  owner_name: string;
  pg_name: string;
  mobile: string;
  location: string;
  pg_type: PgAccount["pg_type"];
  category: PgAccount["category"];
  subscription_plan: PgAccount["subscription_plan"];
  owner_email: string;
  owner_password: string;
}): PgAccount {
  const pgId = uid("pg");
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  const pg: PgAccount = {
    id: pgId,
    owner_name: input.owner_name,
    pg_name: input.pg_name,
    mobile: input.mobile,
    location: input.location,
    pg_type: input.pg_type,
    category: input.category,
    status: "active",
    subscription_plan: input.subscription_plan,
    subscription_expiry: expiry.toISOString().slice(0, 10),
    created_by: "u_super",
    created_at: new Date().toISOString(),
  };
  db.pgAccounts.push(pg);
  // create the owner's admin login (in Supabase: auth user + profiles row)
  db.profiles.push({
    id: uid("u"),
    role: "admin",
    pg_id: pgId,
    full_name: input.owner_name,
    email: input.owner_email,
    phone: input.mobile,
    password: input.owner_password || DEMO_PASSWORD,
    created_at: new Date().toISOString(),
  });
  return pg;
}

export function setPgStatus(id: string, status: PgAccount["status"]): void {
  const pg = db.pgAccounts.find((p) => p.id === id);
  if (pg) pg.status = status;
}

/* --------------------------------- rooms --------------------------------- */

export function listRooms(pgId: string): Room[] {
  return db.rooms
    .filter((r) => r.pg_id === pgId)
    .sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));
}

export function getRoom(id: string): Room | undefined {
  return db.rooms.find((r) => r.id === id);
}

function deriveRoomStatus(r: Room): Room["status"] {
  if (r.occupied_beds <= 0) return "vacant";
  if (r.occupied_beds >= r.total_beds) return "occupied";
  return "partial";
}

export function createRoom(input: {
  pg_id: string;
  room_number: string;
  floor: number;
  type: Room["type"];
  total_beds: number;
  rent_amount: number;
  wifi_password: string;
  amenities: string[];
}): Room {
  const room: Room = {
    id: uid("r"),
    occupied_beds: 0,
    status: "vacant",
    created_at: new Date().toISOString(),
    ...input,
  };
  db.rooms.push(room);
  return room;
}

export function updateRoom(id: string, patch: Partial<Room>): void {
  const room = db.rooms.find((r) => r.id === id);
  if (!room) return;
  Object.assign(room, patch);
  room.status = deriveRoomStatus(room);
}

/* -------------------------------- tenants -------------------------------- */

export function listTenants(pgId: string): Tenant[] {
  return db.tenants
    .filter((t) => t.pg_id === pgId)
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));
}

export function getTenant(id: string): Tenant | undefined {
  return db.tenants.find((t) => t.id === id);
}

export function getTenantByProfile(profileId: string): Tenant | undefined {
  const profile = getProfile(profileId);
  if (!profile?.tenant_id) return undefined;
  return getTenant(profile.tenant_id);
}

export function createTenant(input: {
  pg_id: string;
  room_id: string | null;
  name: string;
  phone: string;
  email: string;
  aadhaar_number: string | null;
  rent_amount: number;
  security_deposit: number;
  checkin_date: string;
  rent_due_day: number;
  login_password: string;
}): Tenant {
  const tenantId = uid("t");
  const tenant: Tenant = {
    id: tenantId,
    pg_id: input.pg_id,
    room_id: input.room_id,
    name: input.name,
    phone: input.phone,
    email: input.email,
    aadhaar_number: input.aadhaar_number,
    emergency_contact: null,
    rent_amount: input.rent_amount,
    security_deposit: input.security_deposit,
    checkin_date: input.checkin_date,
    checkout_date: null,
    rent_due_day: input.rent_due_day,
    food_plan_active: false,
    status: "active",
    created_at: new Date().toISOString(),
  };
  db.tenants.push(tenant);
  if (input.room_id) {
    const room = db.rooms.find((r) => r.id === input.room_id);
    if (room && room.occupied_beds < room.total_beds) {
      room.occupied_beds += 1;
      room.status = deriveRoomStatus(room);
    }
  }
  // create the tenant login (Supabase: auth user + profiles row)
  db.profiles.push({
    id: uid("u"),
    role: "tenant",
    pg_id: input.pg_id,
    tenant_id: tenantId,
    full_name: input.name,
    email: input.email,
    phone: input.phone,
    password: input.login_password || DEMO_PASSWORD,
    created_at: new Date().toISOString(),
  });
  return tenant;
}

export function checkoutTenant(id: string, checkoutDate: string): void {
  const tenant = db.tenants.find((t) => t.id === id);
  if (!tenant || tenant.status === "checked_out") return;
  tenant.status = "checked_out";
  tenant.checkout_date = checkoutDate;
  if (tenant.room_id) {
    const room = db.rooms.find((r) => r.id === tenant.room_id);
    if (room && room.occupied_beds > 0) {
      room.occupied_beds -= 1;
      room.status = deriveRoomStatus(room);
    }
  }
}

/* -------------------------------- payments ------------------------------- */

export function listPayments(pgId: string, month?: string): Payment[] {
  return db.payments.filter(
    (p) => p.pg_id === pgId && (month ? p.month_for === month : true),
  );
}

export function getPaymentsForTenant(tenantId: string): Payment[] {
  return db.payments
    .filter((p) => p.tenant_id === tenantId)
    .sort((a, b) => b.month_for.localeCompare(a.month_for));
}

export function recordPayment(input: {
  pg_id: string;
  tenant_id: string;
  month_for: string;
  base_rent: number;
  electricity_charge: number;
  food_charge: number;
  other_charges: number;
  amount_paid: number;
  payment_mode: Payment["payment_mode"];
  notes: string | null;
}): Payment {
  const total =
    input.base_rent + input.electricity_charge + input.food_charge + input.other_charges;
  const status: Payment["status"] =
    input.amount_paid >= total ? "paid" : input.amount_paid > 0 ? "partial" : "due";
  const existing = db.payments.find(
    (p) => p.tenant_id === input.tenant_id && p.month_for === input.month_for,
  );
  const record: Payment = {
    id: existing?.id ?? uid("pay"),
    pg_id: input.pg_id,
    tenant_id: input.tenant_id,
    month_for: input.month_for,
    base_rent: input.base_rent,
    electricity_charge: input.electricity_charge,
    food_charge: input.food_charge,
    other_charges: input.other_charges,
    total_amount: total,
    amount_paid: input.amount_paid,
    payment_mode: input.payment_mode,
    payment_date: input.amount_paid > 0 ? new Date().toISOString().slice(0, 10) : null,
    status,
    notes: input.notes,
  };
  if (existing) Object.assign(existing, record);
  else db.payments.push(record);
  return record;
}

/* --------------------------------- issues -------------------------------- */

export function listIssues(pgId: string): Issue[] {
  return db.issues
    .filter((i) => i.pg_id === pgId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listIssuesForTenant(tenantId: string): Issue[] {
  return db.issues
    .filter((i) => i.tenant_id === tenantId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function createIssue(input: {
  pg_id: string;
  tenant_id: string;
  category: Issue["category"];
  description: string;
}): Issue {
  const issue: Issue = {
    id: uid("i"),
    pg_id: input.pg_id,
    tenant_id: input.tenant_id,
    category: input.category,
    description: input.description,
    photo_url: null,
    status: "open",
    assigned_to: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
  };
  db.issues.unshift(issue);
  return issue;
}

export function setIssueStatus(id: string, status: Issue["status"]): void {
  const issue = db.issues.find((i) => i.id === id);
  if (!issue) return;
  issue.status = status;
  issue.resolved_at = status === "resolved" ? new Date().toISOString() : null;
}

/* ------------------------------- aggregates ------------------------------ */

export function adminKpis(pgId: string, month: string) {
  const tenants = listTenants(pgId).filter((t) => t.status === "active");
  const rooms = listRooms(pgId);
  const totalBeds = rooms.reduce((s, r) => s + r.total_beds, 0);
  const occupiedBeds = rooms.reduce((s, r) => s + r.occupied_beds, 0);
  const payments = listPayments(pgId, month);
  const collected = payments.reduce((s, p) => s + p.amount_paid, 0);
  const billed = payments.reduce((s, p) => s + p.total_amount, 0);
  return {
    totalTenants: tenants.length,
    totalBeds,
    occupiedBeds,
    occupancyPct: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    collected,
    due: Math.max(billed - collected, 0),
    billed,
  };
}

export function platformStats() {
  const pgs = listPgAccounts();
  const tenants = db.tenants.filter((t) => t.status === "active").length;
  const active = pgs.filter((p) => p.status === "active").length;
  return {
    totalPgs: pgs.length,
    activePgs: active,
    totalTenants: tenants,
    mrr: pgs
      .filter((p) => p.status === "active")
      .reduce((s, p) => s + (p.subscription_plan === "pro" ? 8000 : p.subscription_plan === "lifetime" ? 0 : 5000), 0),
  };
}

export function currentMonth(): string {
  return "2026-06";
}
