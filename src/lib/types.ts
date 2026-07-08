/* =========================================================================
   PG360 domain types — mirror the Supabase schema (see supabase/migrations).
   ========================================================================= */

export type Role = "super_admin" | "admin" | "staff" | "tenant";

export type PgType = "boys" | "girls" | "coliving";
export type PgCategory = "budget" | "standard" | "premium";
export type PgStatus = "active" | "suspended";
export type SubscriptionPlan = "starter" | "pro" | "lifetime";

/** Areas a staff member can be granted access to. */
export const STAFF_MODULES = [
  "tenants",
  "payments",
  "rooms",
  "expenses",
  "complaints",
  "bookings",
  "reports",
] as const;
export type StaffModule = (typeof STAFF_MODULES)[number];

export const STAFF_MODULE_LABELS: Record<StaffModule, string> = {
  tenants: "Tenants",
  payments: "Payments",
  rooms: "Rooms & pricing",
  expenses: "Expenses",
  complaints: "Complaints",
  bookings: "Bookings",
  reports: "Reports",
};

/** A staff member's privileges. null = full access (owners / legacy staff). */
export interface StaffPermissions {
  modules: StaffModule[];
  edit: boolean;
  delete: boolean;
}

export interface Profile {
  id: string;
  role: Role;
  pg_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  // demo-only: never store plaintext passwords in real Supabase auth
  password?: string;
  tenant_id?: string | null;
  created_at: string;
}

/** Per-property feature toggles (stored in pg_accounts.settings jsonb).
 *  Undefined means "on" — a module is only hidden when explicitly false. */
export interface PropertySettings {
  food?: boolean;
  bookings?: boolean;
  complaints?: boolean;
  electricity?: boolean;
  daily_stay?: boolean;
  reviews?: boolean;
  visitors?: boolean;
}

/** Module keys that are wired up and gate navigation today. */
export const ACTIVE_MODULES = ["food", "bookings", "complaints"] as const;

export interface PgAccount {
  id: string;
  owner_id: string | null;
  owner_name: string;
  pg_name: string;
  mobile: string;
  location: string;
  pg_type: PgType;
  category: PgCategory;
  status: PgStatus;
  subscription_plan: SubscriptionPlan;
  subscription_expiry: string;
  created_by: string;
  created_at: string;
  upi_id: string | null;
  bank_details: string | null;
  payment_qr_url: string | null;
  settings: PropertySettings;
  owner_pan: string | null;
  property_address: string | null;
  food_included_default: boolean;
  food_opt_out_deduction: number;
  edition: "full" | "gvm";
  portal_enabled: boolean;
  reg_prefix: string | null;
  owner_signature_url: string | null;
  is_demo: boolean;
}

export interface ActivityEntry {
  id: string;
  pg_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}

export interface AgreementSection {
  id: string;
  pg_id: string;
  idx: number;
  title: string;
  body: string;
  created_at: string;
}

export interface TenantAgreement {
  id: string;
  pg_id: string;
  tenant_id: string;
  signature_url: string;
  accepted_at: string;
}

export type DocType = "aadhaar" | "dl" | "passport" | "voter" | "other";

export const DOC_LABELS: Record<DocType, string> = {
  aadhaar: "Aadhaar",
  dl: "Driving License",
  passport: "Passport",
  voter: "Voter ID",
  other: "Other",
};

export interface TenantDocument {
  id: string;
  pg_id: string;
  tenant_id: string;
  doc_type: DocType;
  file_url: string;
  label: string | null;
  created_at: string;
}

/** Per-property money rules (notice / lock-in / deposit / electricity cap). */
export interface PgPolicy {
  id: string;
  pg_id: string;
  notice_period_days: number;
  lock_in_months: number;
  deposit_months: number;
  electricity_included_units: number;
  electricity_per_unit_rate: number;
  created_at: string;
}

export interface JoiningFee {
  id: string;
  pg_id: string;
  tenant_id: string;
  amount: number;
  description: string;
  paid: boolean;
  paid_date: string | null;
  created_at: string;
}

export type SettlementStatus = "draft" | "confirmed" | "paid";

export interface CheckoutSettlement {
  id: string;
  pg_id: string;
  tenant_id: string;
  checkout_date: string;
  last_paid_until: string | null;
  pro_rata_days_owed: number;
  pro_rata_amount: number;
  notice_shortfall_days: number;
  notice_penalty: number;
  lock_in_forfeiture: number;
  damages_deduction: number;
  deposit_amount: number;
  refundable_amount: number;
  notes: string | null;
  status: SettlementStatus;
  created_at: string;
}

export interface WifiNetwork {
  id: string;
  pg_id: string;
  ssid: string;
  password: string;
  created_at: string;
}

export type RoomType = "single" | "double" | "triple";
export type RoomStatus = "vacant" | "partial" | "occupied";
export type BathType = "attached" | "common";

export interface RateCard {
  id: string;
  pg_id: string;
  name: string;
  room_type: string;
  ac: boolean;
  bath_type: BathType;
  price_per_month: number;
  food_included: boolean;
  food_opt_out_deduction: number;
  created_at: string;
}

export type BedStatus = "vacant" | "occupied";

export interface Bed {
  id: string;
  pg_id: string;
  room_id: string;
  bed_number: string;
  rate_card_id: string | null;
  price_per_month: number;
  status: BedStatus;
  current_tenant_id: string | null;
  available_from: string | null;
  notes: string | null;
  created_at: string;
}

export interface Floor {
  id: string;
  pg_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Room {
  id: string;
  pg_id: string;
  room_number: string;
  floor: number;
  floor_id: string | null;
  type: RoomType;
  total_beds: number;
  occupied_beds: number;
  rent_amount: number;
  wifi_password: string;
  wifi_network_id: string | null;
  wifi_ssid: string | null;
  amenities: string[];
  status: RoomStatus;
  created_at: string;
}

export type TenantStatus = "active" | "checked_out";

export interface Tenant {
  id: string;
  pg_id: string;
  room_id: string | null;
  bed_id: string | null;
  name: string;
  phone: string;
  parent_phone: string | null;
  guardian: string | null;
  vehicle_number: string | null;
  address: string | null;
  occupation: string | null;
  organization: string | null;
  email: string;
  reg_no: string | null;
  avatar_url: string | null;
  aadhaar_number: string | null;
  aadhaar_photo_url: string | null;
  emergency_contact: string | null;
  rent_amount: number;
  security_deposit: number;
  checkin_date: string;
  checkout_date: string | null;
  rent_due_day: number;
  food_plan_active: boolean;
  food_opt_out: boolean;
  joining_date: string | null;
  notice_given_date: string | null;
  lock_in_end_date: string | null;
  status: TenantStatus;
  created_at: string;
  /** "monthly" (rent per month) or "daily" (fixed stay billed once). */
  stay_type: "monthly" | "daily";
  daily_rate: number | null;
  stay_days: number | null;
}

export type TenantEventType =
  | "joined"
  | "room_changed"
  | "payment"
  | "complaint"
  | "note"
  | "checked_out";

export interface TenantEvent {
  id: string;
  pg_id: string;
  tenant_id: string;
  type: TenantEventType;
  detail: string | null;
  room_id: string | null;
  floor: number | null;
  created_by: string | null;
  created_at: string;
}

export type PaymentMode = "cash" | "upi" | "bank";
export type PaymentStatus = "paid" | "partial" | "due";

export interface Payment {
  id: string;
  pg_id: string;
  tenant_id: string;
  month_for: string; // "2026-06"
  base_rent: number;
  electricity_charge: number;
  food_charge: number;
  other_charges: number;
  security_deposit: number;
  joining_fee: number;
  total_amount: number;
  amount_paid: number;
  payment_mode: PaymentMode | null;
  payment_screenshot_url: string | null;
  payment_date: string | null;
  status: PaymentStatus;
  verified: boolean;
  is_pro_rata: boolean;
  pro_rata_days: number | null;
  food_opt_out_deduction: number;
  notes: string | null;
}

export type IssueCategory =
  | "electricity"
  | "plumbing"
  | "wifi"
  | "cleaning"
  | "noise"
  | "other";
export type IssueStatus = "open" | "in_progress" | "resolved";

export interface Issue {
  id: string;
  pg_id: string;
  tenant_id: string;
  category: IssueCategory;
  description: string;
  photo_url: string | null;
  status: IssueStatus;
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** Built-in categories; custom property-defined categories are also allowed,
 *  so the stored value is widened to string. */
export type ExpenseCategory =
  | "rent"
  | "salaries"
  | "utilities"
  | "groceries"
  | "maintenance"
  | "supplies"
  | "marketing"
  | "other"
  | (string & {});

export interface Expense {
  id: string;
  pg_id: string;
  category: ExpenseCategory;
  subcategory: string | null;
  amount: number;
  date: string;
  description: string | null;
  added_by: string | null;
  created_at: string;
}

export type MealType = "breakfast" | "lunch" | "dinner";

export interface FoodMenuItem {
  id: string;
  pg_id: string;
  day_of_week: number; // 0=Mon .. 6=Sun
  meal_type: MealType;
  description: string;
  created_at: string;
}

export type BookingStatus = "pending" | "approved" | "rejected";

export interface Booking {
  id: string;
  pg_id: string;
  tenant_name: string;
  phone: string;
  preferred_room_type: "single" | "double" | "triple" | "any";
  requested_date: string | null;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  pg_id: string;
  recipient_id: string;
  recipient_type: Role;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface PropertyRef {
  id: string;
  name: string;
}

export interface SessionUser {
  id: string;
  role: Role;
  pg_id: string | null;
  tenant_id: string | null;
  full_name: string;
  email: string;
  /** Properties this admin/staff is a member of (empty for tenant/super). */
  properties: PropertyRef[];
  /** The property the admin is currently acting on (cookie-selected, validated). */
  activePropertyId: string | null;
  /** Whether the relevant PG is suspended (resolved once, with the session). */
  suspended: boolean;
  /** Set when a super-admin is viewing a PG as its owner ("open / view as"). */
  impersonating?: { pgId: string; pgName: string } | null;
  /** When the user accepted the current terms (null = not yet, gate them). */
  termsAcceptedAt?: string | null;
  /** Staff privileges; null = full access (owners + legacy staff). */
  permissions?: StaffPermissions | null;
}

export interface PlatformInvoice {
  id: string;
  pg_id: string;
  number: number;
  description: string;
  amount: number;
  tax_percent: number;
  billing_cycle: "one_time" | "monthly" | "yearly";
  period_label: string | null;
  issue_date: string;
  due_date: string | null;
  status: "unpaid" | "paid";
  notes: string | null;
  created_by: string | null;
  created_at: string;
}
