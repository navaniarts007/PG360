"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { markAllNotificationsReadAction, fetchMyNotificationsAction } from "@/lib/actions/notifications";
import type { AppNotification } from "@/lib/types";

const POLL_MS = 20_000;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell({
  userId,
  initial,
}: {
  userId: string;
  initial: AppNotification[];
}) {
  const [items, setItems] = useState<AppNotification[]>(initial);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.is_read).length;

  // Polling replacement for the original Supabase Realtime subscription — no
  // MySQL equivalent exists, so new notifications arrive within POLL_MS
  // instead of instantly. Merges by id so an in-flight "mark all read" isn't
  // clobbered by a stale poll response.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const fresh = await fetchMyNotificationsAction(30);
        if (cancelled) return;
        setItems((prev) => {
          const readIds = new Set(prev.filter((n) => n.is_read).map((n) => n.id));
          return fresh.map((n) => (readIds.has(n.id) ? { ...n, is_read: true } : n));
        });
      } catch {
        /* best-effort */
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [userId]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      void markAllNotificationsReadAction();
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative grid size-10 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-clay-500 px-1 text-[0.6rem] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-paper shadow-pop animate-rise">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-display text-sm font-semibold text-ink">Notifications</p>
            {items.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-teal-600">
                <Check className="size-3.5" /> All caught up
              </span>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-muted">
                Nothing yet. We&apos;ll ping you here.
              </p>
            ) : (
              items.map((n) => {
                const body = (
                  <>
                    <p className="text-sm text-ink">{n.message}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{timeAgo(n.created_at)}</p>
                  </>
                );
                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    onClick={() => setOpen(false)}
                    className="block border-b border-line px-4 py-3 transition-colors last:border-0 hover:bg-paper-2/50"
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={n.id} className="border-b border-line px-4 py-3 last:border-0">
                    {body}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
