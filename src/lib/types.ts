/* =========================================================================
   PG360 domain types — mirror the Supabase schema (see supabase/migrations).
   ========================================================================= */

export type Role = "super_admin" | "admin" | "staff" | "tenant";

export type PgType = "boys" | "girls" | "coliving";
export type PgCategory = "budget" | "standard" | "premium";
export type PgStatus = "active" | "suspended";
export type SubscriptionPlan = "starter" | "pro" | "lifetime";

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

export interface PgAccount {
  id: string;
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
}

export type RoomType = "single" | "double" | "triple";
export type RoomStatus = "vacant" | "partial" | "occupied";

export interface Room {
  id: string;
  pg_id: string;
  room_number: string;
  floor: number;
  type: RoomType;
  total_beds: number;
  occupied_beds: number;
  rent_amount: number;
  wifi_password: string;
  amenities: string[];
  status: RoomStatus;
  created_at: string;
}

export type TenantStatus = "active" | "checked_out";

export interface Tenant {
  id: string;
  pg_id: string;
  room_id: string | null;
  name: string;
  phone: string;
  email: string;
  aadhaar_number: string | null;
  emergency_contact: string | null;
  rent_amount: number;
  security_deposit: number;
  checkin_date: string;
  checkout_date: string | null;
  rent_due_day: number;
  food_plan_active: boolean;
  status: TenantStatus;
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
  total_amount: number;
  amount_paid: number;
  payment_mode: PaymentMode | null;
  payment_screenshot_url: string | null;
  payment_date: string | null;
  status: PaymentStatus;
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

export type ExpenseCategory =
  | "rent"
  | "salaries"
  | "utilities"
  | "groceries"
  | "maintenance"
  | "supplies"
  | "marketing"
  | "other";

export interface Expense {
  id: string;
  pg_id: string;
  category: ExpenseCategory;
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
}
