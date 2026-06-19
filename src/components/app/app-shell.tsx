"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BedDouble,
  Building2,
  CalendarCheck,
  CreditCard,
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
} from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  module?: keyof PropertySettings;
}

const NAVS: Record<"super" | "admin" | "tenant", NavItem[]> = {
  super: [
    { href: "/platform", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/platform/accounts", label: "PG Accounts", icon: Building2 },
  ],
  admin: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/dashboard/properties", label: "Properties", icon: Building2 },
    { href: "/dashboard/rooms", label: "Rooms & beds", icon: BedDouble },
    { href: "/dashboard/pricing", label: "Pricing", icon: Tag },
    { href: "/dashboard/tenants", label: "Tenants", icon: Users },
    { href: "/dashboard/staff", label: "Staff", icon: UserCog },
    { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck, module: "bookings" },
    { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
    { href: "/dashboard/food", label: "Food menu", icon: UtensilsCrossed, module: "food" },
    { href: "/dashboard/expenses", label: "Expenses", icon: Wallet },
    { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
    { href: "/dashboard/issues", label: "Complaints", icon: MessagesSquare, module: "complaints" },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
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
  children: React.ReactNode;
}) {
  const nav = NAVS[navKey(role)].filter(
    (item) => !item.module || settings[item.module] !== false,
  );
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

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
        <Logo />
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
        {/* mobile topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-paper/80 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="grid size-10 place-items-center rounded-xl text-ink hover:bg-paper-2"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <Logo />
          <NotificationBell userId={userId} initial={notifications} />
        </header>

        {/* desktop top bar */}
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-end border-b border-line bg-paper/70 px-8 backdrop-blur lg:flex">
          <NotificationBell userId={userId} initial={notifications} />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
