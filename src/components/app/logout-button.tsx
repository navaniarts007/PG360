"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className={cn(
          "inline-flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-rose-50 hover:text-rose-600",
          className,
        )}
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </form>
  );
}
