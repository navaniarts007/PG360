import type {
  Issue,
  Payment,
  PgAccount,
  Profile,
  Room,
  Tenant,
} from "./types";

/* =========================================================================
   Demo seed — realistic Indian PG data so the product looks alive in DEMO
   mode. When real Supabase keys are present this is ignored; the SQL seed in
   supabase/seed.sql mirrors it.
   ========================================================================= */

export const DEMO_PASSWORD = "demo1234";
const NOW = "2026-06-15T09:00:00+05:30";
const MONTH = "2026-06";

export const demoPgAccounts: PgAccount[] = [
  {
    id: "pg_1",
    owner_name: "Ravi Kumar",
    pg_name: "Sunrise Stay",
    mobile: "+919845012345",
    location: "Koramangala, Bengaluru",
    pg_type: "coliving",
    category: "premium",
    status: "active",
    subscription_plan: "pro",
    subscription_expiry: "2027-04-01",
    created_by: "u_super",
    created_at: "2025-04-02T10:00:00+05:30",
  },
  {
    id: "pg_2",
    owner_name: "Meena Iyer",
    pg_name: "Green Nest Hostel",
    mobile: "+919812233445",
    location: "HSR Layout, Bengaluru",
    pg_type: "girls",
    category: "standard",
    status: "active",
    subscription_plan: "starter",
    subscription_expiry: "2026-12-01",
    created_by: "u_super",
    created_at: "2025-09-18T10:00:00+05:30",
  },
  {
    id: "pg_3",
    owner_name: "Imran Shaikh",
    pg_name: "Metro Boys PG",
    mobile: "+919900110022",
    location: "Andheri East, Mumbai",
    pg_type: "boys",
    category: "budget",
    status: "suspended",
    subscription_plan: "starter",
    subscription_expiry: "2026-02-01",
    created_by: "u_super",
    created_at: "2025-06-10T10:00:00+05:30",
  },
];

export const demoProfiles: Profile[] = [
  {
    id: "u_super",
    role: "super_admin",
    pg_id: null,
    full_name: "Platform Owner",
    email: "owner@pg360.app",
    phone: "+919000000001",
    password: DEMO_PASSWORD,
    created_at: "2025-01-01T10:00:00+05:30",
  },
  {
    id: "u_ravi",
    role: "admin",
    pg_id: "pg_1",
    full_name: "Ravi Kumar",
    email: "ravi@sunrisepg.in",
    phone: "+919845012345",
    password: DEMO_PASSWORD,
    created_at: "2025-04-02T10:05:00+05:30",
  },
  {
    id: "u_staff",
    role: "staff",
    pg_id: "pg_1",
    full_name: "Lakshmi Warden",
    email: "warden@sunrisepg.in",
    phone: "+919845099999",
    password: DEMO_PASSWORD,
    created_at: "2025-04-05T10:00:00+05:30",
  },
  {
    id: "u_arjun",
    role: "tenant",
    pg_id: "pg_1",
    tenant_id: "t_1",
    full_name: "Arjun Nair",
    email: "arjun@tenant.in",
    phone: "+919812000001",
    password: DEMO_PASSWORD,
    created_at: "2025-04-10T10:00:00+05:30",
  },
  {
    id: "u_meena",
    role: "admin",
    pg_id: "pg_2",
    full_name: "Meena Iyer",
    email: "meena@greennest.in",
    phone: "+919812233445",
    password: DEMO_PASSWORD,
    created_at: "2025-09-18T10:05:00+05:30",
  },
];

export const demoRooms: Room[] = [
  {
    id: "r_101",
    pg_id: "pg_1",
    room_number: "101",
    floor: 1,
    type: "double",
    total_beds: 2,
    occupied_beds: 2,
    rent_amount: 12000,
    wifi_password: "Sunrise@101",
    amenities: ["AC", "Attached bath", "Geyser", "Study table"],
    status: "occupied",
    created_at: "2025-04-03T10:00:00+05:30",
  },
  {
    id: "r_102",
    pg_id: "pg_1",
    room_number: "102",
    floor: 1,
    type: "triple",
    total_beds: 3,
    occupied_beds: 2,
    rent_amount: 9000,
    wifi_password: "Sunrise@102",
    amenities: ["Fan", "Common bath", "Wardrobe"],
    status: "partial",
    created_at: "2025-04-03T10:00:00+05:30",
  },
  {
    id: "r_201",
    pg_id: "pg_1",
    room_number: "201",
    floor: 2,
    type: "single",
    total_beds: 1,
    occupied_beds: 1,
    rent_amount: 16000,
    wifi_password: "Sunrise@201",
    amenities: ["AC", "Attached bath", "Balcony", "Smart TV"],
    status: "occupied",
    created_at: "2025-04-03T10:00:00+05:30",
  },
  {
    id: "r_202",
    pg_id: "pg_1",
    room_number: "202",
    floor: 2,
    type: "double",
    total_beds: 2,
    occupied_beds: 1,
    rent_amount: 12500,
    wifi_password: "Sunrise@202",
    amenities: ["AC", "Attached bath", "Study table"],
    status: "partial",
    created_at: "2025-04-03T10:00:00+05:30",
  },
  {
    id: "r_301",
    pg_id: "pg_1",
    room_number: "301",
    floor: 3,
    type: "triple",
    total_beds: 3,
    occupied_beds: 3,
    rent_amount: 8500,
    wifi_password: "Sunrise@301",
    amenities: ["Fan", "Common bath", "Wardrobe"],
    status: "occupied",
    created_at: "2025-04-03T10:00:00+05:30",
  },
  {
    id: "r_302",
    pg_id: "pg_1",
    room_number: "302",
    floor: 3,
    type: "double",
    total_beds: 2,
    occupied_beds: 0,
    rent_amount: 11000,
    wifi_password: "Sunrise@302",
    amenities: ["AC", "Attached bath", "Balcony"],
    status: "vacant",
    created_at: "2025-04-03T10:00:00+05:30",
  },
];

type SeedTenant = Omit<Tenant, "pg_id" | "created_at" | "status" | "checkout_date"> & {
  status?: Tenant["status"];
  checkout_date?: string | null;
};

const seedTenants: SeedTenant[] = [
  { id: "t_1", room_id: "r_201", name: "Arjun Nair", phone: "+919812000001", email: "arjun@tenant.in", aadhaar_number: "XXXX-XXXX-4471", emergency_contact: "+919812000099", rent_amount: 16000, security_deposit: 32000, checkin_date: "2025-04-10", rent_due_day: 5, food_plan_active: true },
  { id: "t_2", room_id: "r_101", name: "Priya Sharma", phone: "+919812000002", email: "priya@tenant.in", aadhaar_number: "XXXX-XXXX-1182", emergency_contact: "+919812000098", rent_amount: 12000, security_deposit: 24000, checkin_date: "2025-05-01", rent_due_day: 5, food_plan_active: true },
  { id: "t_3", room_id: "r_101", name: "Karthik Reddy", phone: "+919812000003", email: "karthik@tenant.in", aadhaar_number: "XXXX-XXXX-9920", emergency_contact: "+919812000097", rent_amount: 12000, security_deposit: 24000, checkin_date: "2025-06-15", rent_due_day: 10, food_plan_active: false },
  { id: "t_4", room_id: "r_102", name: "Sneha Patil", phone: "+919812000004", email: "sneha@tenant.in", aadhaar_number: "XXXX-XXXX-3310", emergency_contact: "+919812000096", rent_amount: 9000, security_deposit: 18000, checkin_date: "2025-07-20", rent_due_day: 5, food_plan_active: true },
  { id: "t_5", room_id: "r_102", name: "Mohit Verma", phone: "+919812000005", email: "mohit@tenant.in", aadhaar_number: "XXXX-XXXX-7745", emergency_contact: "+919812000095", rent_amount: 9000, security_deposit: 18000, checkin_date: "2025-08-02", rent_due_day: 5, food_plan_active: true },
  { id: "t_6", room_id: "r_202", name: "Aisha Khan", phone: "+919812000006", email: "aisha@tenant.in", aadhaar_number: "XXXX-XXXX-2256", emergency_contact: "+919812000094", rent_amount: 12500, security_deposit: 25000, checkin_date: "2025-09-12", rent_due_day: 7, food_plan_active: false },
  { id: "t_7", room_id: "r_301", name: "Rahul Das", phone: "+919812000007", email: "rahul@tenant.in", aadhaar_number: "XXXX-XXXX-6601", emergency_contact: "+919812000093", rent_amount: 8500, security_deposit: 17000, checkin_date: "2025-04-22", rent_due_day: 5, food_plan_active: true },
  { id: "t_8", room_id: "r_301", name: "Vikram Singh", phone: "+919812000008", email: "vikram@tenant.in", aadhaar_number: "XXXX-XXXX-8834", emergency_contact: "+919812000092", rent_amount: 8500, security_deposit: 17000, checkin_date: "2025-05-30", rent_due_day: 5, food_plan_active: true },
  { id: "t_9", room_id: "r_301", name: "Faisal Ahmed", phone: "+919812000009", email: "faisal@tenant.in", aadhaar_number: "XXXX-XXXX-1199", emergency_contact: "+919812000091", rent_amount: 8500, security_deposit: 17000, checkin_date: "2025-10-01", rent_due_day: 10, food_plan_active: false },
  { id: "t_10", room_id: null, name: "Deepa Menon", phone: "+919812000010", email: "deepa@tenant.in", aadhaar_number: "XXXX-XXXX-5567", emergency_contact: "+919812000090", rent_amount: 12500, security_deposit: 25000, checkin_date: "2025-03-01", rent_due_day: 5, food_plan_active: false, status: "checked_out", checkout_date: "2026-05-28" },
];

export const demoTenants: Tenant[] = seedTenants.map((t) => ({
  pg_id: "pg_1",
  created_at: NOW,
  status: t.status ?? "active",
  checkout_date: t.checkout_date ?? null,
  ...t,
}));

// Build current-month payments with a realistic spread of paid / partial / due.
const paymentPlan: Array<{
  tenant_id: string;
  electricity: number;
  food: number;
  paid: number;
  mode: Payment["payment_mode"];
  date: string | null;
}> = [
  { tenant_id: "t_1", electricity: 850, food: 3000, paid: 19850, mode: "upi", date: "2026-06-04" },
  { tenant_id: "t_2", electricity: 600, food: 3000, paid: 15600, mode: "upi", date: "2026-06-03" },
  { tenant_id: "t_3", electricity: 600, food: 0, paid: 0, mode: null, date: null },
  { tenant_id: "t_4", electricity: 500, food: 3000, paid: 6000, mode: "cash", date: "2026-06-06" },
  { tenant_id: "t_5", electricity: 500, food: 3000, paid: 12500, mode: "bank", date: "2026-06-02" },
  { tenant_id: "t_6", electricity: 700, food: 0, paid: 0, mode: null, date: null },
  { tenant_id: "t_7", electricity: 450, food: 3000, paid: 11950, mode: "upi", date: "2026-06-05" },
  { tenant_id: "t_8", electricity: 450, food: 3000, paid: 5000, mode: "upi", date: "2026-06-07" },
  { tenant_id: "t_9", electricity: 450, food: 0, paid: 0, mode: null, date: null },
];

export const demoPayments: Payment[] = paymentPlan.map((p, i) => {
  const tenant = demoTenants.find((t) => t.id === p.tenant_id)!;
  const total = tenant.rent_amount + p.electricity + p.food;
  const status: Payment["status"] =
    p.paid >= total ? "paid" : p.paid > 0 ? "partial" : "due";
  return {
    id: `pay_${i + 1}`,
    pg_id: "pg_1",
    tenant_id: p.tenant_id,
    month_for: MONTH,
    base_rent: tenant.rent_amount,
    electricity_charge: p.electricity,
    food_charge: p.food,
    other_charges: 0,
    total_amount: total,
    amount_paid: p.paid,
    payment_mode: p.mode,
    payment_date: p.date,
    status,
    notes: status === "partial" ? "Balance promised by 15th" : null,
  };
});

// A little payment history for tenant t_1 (Arjun) so the bill page has depth.
export const demoPaymentHistory: Payment[] = [
  {
    id: "pay_h1",
    pg_id: "pg_1",
    tenant_id: "t_1",
    month_for: "2026-05",
    base_rent: 16000,
    electricity_charge: 780,
    food_charge: 3000,
    other_charges: 0,
    total_amount: 19780,
    amount_paid: 19780,
    payment_mode: "upi",
    payment_date: "2026-05-04",
    status: "paid",
    notes: null,
  },
  {
    id: "pay_h2",
    pg_id: "pg_1",
    tenant_id: "t_1",
    month_for: "2026-04",
    base_rent: 16000,
    electricity_charge: 690,
    food_charge: 3000,
    other_charges: 0,
    total_amount: 19690,
    amount_paid: 19690,
    payment_mode: "upi",
    payment_date: "2026-04-03",
    status: "paid",
    notes: null,
  },
];

export const demoIssues: Issue[] = [
  {
    id: "i_1",
    pg_id: "pg_1",
    tenant_id: "t_1",
    category: "wifi",
    description: "WiFi keeps dropping every evening around 8pm on the 2nd floor.",
    photo_url: null,
    status: "in_progress",
    assigned_to: "u_staff",
    created_at: "2026-06-12T20:14:00+05:30",
    resolved_at: null,
  },
  {
    id: "i_2",
    pg_id: "pg_1",
    tenant_id: "t_4",
    category: "plumbing",
    description: "Wash basin in 102 is draining very slowly.",
    photo_url: null,
    status: "open",
    assigned_to: null,
    created_at: "2026-06-13T11:40:00+05:30",
    resolved_at: null,
  },
  {
    id: "i_3",
    pg_id: "pg_1",
    tenant_id: "t_7",
    category: "electricity",
    description: "Tube light in 301 flickers and one socket isn't working.",
    photo_url: null,
    status: "resolved",
    assigned_to: "u_staff",
    created_at: "2026-06-08T09:10:00+05:30",
    resolved_at: "2026-06-09T15:30:00+05:30",
  },
  {
    id: "i_4",
    pg_id: "pg_1",
    tenant_id: "t_2",
    category: "cleaning",
    description: "Common area on 1st floor needs deep cleaning.",
    photo_url: null,
    status: "resolved",
    assigned_to: "u_staff",
    created_at: "2026-06-05T08:00:00+05:30",
    resolved_at: "2026-06-05T18:00:00+05:30",
  },
];
