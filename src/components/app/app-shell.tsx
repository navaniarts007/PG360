"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  BarChart3,
  BedDouble,
  Building2,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  Eye,
  History,
  LayoutDashboard,
  type LucideIcon,
  Menu,
  MessageCircle,
  MessagesSquare,
  Receipt,
  Settings,
  Tag,
  UserCog,
  UtensilsCrossed,
  Users,
  Wallet,
  Wifi,
  X,
} from "lucide-react";
import type { Edition } from "@/lib/clients";
import { stopImpersonationAction } from "@/lib/actions/platform";
import { Logo } from "@/components/brand/logo";
import { LogoutButton } from "./logout-button";
import { NotificationBell } from "./notification-bell";
import { PropertySwitcher } from "./property-switcher";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type {
  AppNotification,
  PropertyRef,
  PropertySettings,
  Role,
  StaffModule,
  StaffPermissions,
} from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  module?: keyof PropertySettings;
  /** staff privilege area this item needs (gated when a staff has limited perms). */
  perm?: StaffModule;
  /** only the owner (admin) sees this item. */
  ownerOnly?: boolean;
}

const NAVS: Record<"super" | "admin" | "tenant" | "gvm", NavItem[]> = {
  // Stripped, owner-only edition for customized clients (e.g. GVM Comforts).
  gvm: [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
    { href: "/dashboard/properties", label: "Properties", icon: Building2 },
    { href: "/dashboard/tenants", label: "Tenants", icon: Users },
    { href: "/dashboard/staff", label: "Staff", icon: UserCog },
    { href: "/dashboard/vacated", label: "Vacated", icon: Archive },
    { href: "/dashboard/rooms", label: "Rooms", icon: BedDouble },
    { href: "/dashboard/pricing", label: "Pricing", icon: Tag },
    { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck, module: "bookings" },
    { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
    { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/dashboard/expenses", label: "Expenses", icon: Wallet },
    { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ],
  super: [
    { href: "/platform", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/platform/accounts", label: "PG Accounts", icon: Building2 },
    { href: "/platform/invoices", label: "Invoices", icon: Receipt },
    { href: "/platform/activity", label: "Activity", icon: History },
  ],
  admin: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/dashboard/properties", label: "Properties", icon: Building2 },
    { href: "/dashboard/rooms", label: "Rooms & beds", icon: BedDouble, perm: "rooms" },
    { href: "/dashboard/pricing", label: "Pricing", icon: Tag, perm: "rooms" },
    { href: "/dashboard/tenants", label: "Tenants", icon: Users, perm: "tenants" },
    { href: "/dashboard/vacated", label: "Vacated", icon: Archive, perm: "tenants" },
    { href: "/dashboard/staff", label: "Staff", icon: UserCog, ownerOnly: true },
    { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck, module: "bookings", perm: "bookings" },
    { href: "/dashboard/payments", label: "Payments", icon: CreditCard, perm: "payments" },
    { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays, perm: "payments" },
    { href: "/dashboard/food", label: "Food menu", icon: UtensilsCrossed, module: "food" },
    { href: "/dashboard/expenses", label: "Expenses", icon: Wallet, perm: "expenses" },
    { href: "/dashboard/reports", label: "Reports", icon: BarChart3, perm: "reports" },
    { href: "/dashboard/issues", label: "Complaints", icon: MessagesSquare, module: "complaints", perm: "complaints" },
    { href: "/dashboard/activity", label: "Activity", icon: History, ownerOnly: true },
    { href: "/dashboard/settings", label: "Settings", icon: Settings, ownerOnly: true },
  ],
  tenant: [
    { href: "/portal", label: "My Room", icon: Wifi, exact: true },
    { href: "/portal/bill", label: "My Bill", icon: Receipt },
    { href: "/portal/food", label: "Food menu", icon: UtensilsCrossed, module: "food" },
    { href: "/portal/issues", label: "Complaints", icon: MessagesSquare, module: "complaints" },
    { href: "/portal/contact", label: "Contact", icon: MessageCircle },
  ],
};

function navKey(role: Role): "super" | "admin" | "tenant" {
  if (role === "super_admin") return "super";
  if (role === "tenant") return "tenant";
  return "admin";
}

export function AppShell({
  role,
  user,
  context,
  userId,
  notifications,
  properties,
  activePropertyId,
  settings,
  edition = "full",
  brandName,
  impersonating,
  permissions,
  children,
}: {
  role: Role;
  user: { full_name: string; email: string };
  context: string;
  userId: string;
  notifications: AppNotification[];
  properties: PropertyRef[];
  activePropertyId: string | null;
  settings: PropertySettings;
  edition?: Edition;
  brandName?: string;
  impersonating?: { pgId: string; pgName: string } | null;
  permissions?: StaffPermissions | null;
  children: React.ReactNode;
}) {
  // GVM-style editions get a stripped owner-only nav; everyone else by role.
  const key =
    edition === "gvm" && (role === "admin" || role === "staff")
      ? "gvm"
      : navKey(role);
  const allowedModule = (m: StaffModule) =>
    role !== "staff" || permissions == null || permissions.modules.includes(m);
  const nav = NAVS[key].filter((item) => {
    if (item.module && settings[item.module] === false) return false;
    if (role === "staff") {
      if (item.ownerOnly) return false;
      if (item.perm && !allowedModule(item.perm)) return false;
    }
    return true;
  });
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  // Mobile bottom tab bar: up to 5 quick tabs, "More" opens the full drawer.
  const bottomItems = nav.length > 5 ? nav.slice(0, 4) : nav;
  const showMoreTab = nav.length > 5;

  const roleLabel =
    role === "super_admin"
      ? "Platform"
      : role === "tenant"
        ? "Resident"
        : role === "staff"
          ? "Staff"
          : "PG Owner";

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo label={brandName} />
        <button
          onClick={() => setOpen(false)}
          className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-paper-2 lg:hidden"
          aria-label="Close menu"
        >
          <X className="size-5" />
        </button>
      </div>

      {(role === "admin" || role === "staff") && properties.length > 0 ? (
        <PropertySwitcher properties={properties} activeId={activePropertyId} />
      ) : (
        <div className="mx-3 mb-2 rounded-xl border border-line bg-paper-2/60 px-3 py-2.5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-clay-500">
            {roleLabel}
          </p>
          <p className="truncate text-sm font-medium text-ink">{context}</p>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {nav.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-clay-50 text-clay-700"
                  : "text-ink-soft hover:bg-paper-2 hover:text-ink",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-clay-500" />
              )}
              <item.icon
                className={cn(
                  "size-4.5 transition-colors",
                  active ? "text-clay-600" : "text-ink-muted group-hover:text-ink",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl px-2.5 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-paper">
            {initials(user.full_name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{user.full_name}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
          </div>
        </div>
        <LogoutButton className="mt-1" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface/70 backdrop-blur lg:block">
        {sidebar}
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[82%] border-r border-line bg-paper shadow-pop">
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-h-screen flex-col">
        {/* impersonation banner — super-admin viewing a PG as its owner */}
        {impersonating && (
          <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 bg-ink px-4 py-2 text-paper sm:px-6">
            <span className="flex items-center gap-2 text-sm">
              <Eye className="size-4" />
              Viewing <strong className="font-semibold">{impersonating.pgName}</strong> as its owner
            </span>
            <form action={stopImpersonationAction}>
              <button
                type="submit"
                className="rounded-lg bg-paper/15 px-3 py-1 text-xs font-semibold text-paper transition-colors hover:bg-paper/25"
              >
                Exit to platform
              </button>
            </form>
          </div>
        )}

        {/* mobile topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-paper/80 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="grid size-10 place-items-center rounded-xl text-ink hover:bg-paper-2"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <Logo label={brandName} />
          <NotificationBell userId={userId} initial={notifications} />
        </header>

        {/* desktop top bar */}
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-end border-b border-line bg-paper/70 px-8 backdrop-blur lg:flex">
          <NotificationBell userId={userId} initial={notifications} />
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">{children}</main>
      </div>

      {/* mobile bottom tab bar — native-app navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(66,45,24,0.06)] backdrop-blur lg:hidden">
        {bottomItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[0.62rem] font-semibold transition-colors",
                active ? "text-clay-600" : "text-ink-muted",
              )}
            >
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-xl transition-colors",
                  active && "bg-clay-50",
                )}
              >
                <item.icon className="size-5" />
              </span>
              <span className="max-w-[4.5rem] truncate">{item.label}</span>
            </Link>
          );
        })}
        {showMoreTab && (
          <button
            onClick={() => setOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[0.62rem] font-semibold text-ink-muted"
          >
            <span className="grid size-9 place-items-center rounded-xl">
              <Menu className="size-5" />
            </span>
            More
          </button>
        )}
      </nav>
    </div>
  );
}
