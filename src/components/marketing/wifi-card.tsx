"use client";

import { useState } from "react";
import { Check, Copy, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

/** The signature tenant micro-feature: a prominent, copyable WiFi password. */
export function WifiCard({
  password,
  network = "Sunrise-Stay 5G",
  room = "Room 201",
  className,
}: {
  password: string;
  network?: string;
  room?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  return (
    <div
      className={cn(
        "grain group relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-ink p-5 text-paper shadow-pop transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_15%,rgba(255,255,255,0.12)_48%,transparent_74%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full blur-2xl transition-transform duration-700 group-hover:scale-110"
        style={{ background: "radial-gradient(circle, rgba(217,164,65,0.5), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 left-[-10%] size-36 rounded-full opacity-70 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(14,107,87,0.32), transparent 70%)" }}
      />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <Wifi className="size-4.5 text-gold-300" />
          </span>
          <div>
            <p className="text-xs font-medium text-paper/60">WiFi · {room}</p>
            <p className="text-sm font-semibold">{network}</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-teal-500/20 px-2.5 py-1 text-[0.7rem] font-semibold text-teal-200 ring-1 ring-teal-400/30">
          <span className="size-1.5 animate-pulse rounded-full bg-teal-300" /> Online
        </span>
      </div>

      <button
        onClick={copy}
        className="group relative mt-4 flex w-full items-center justify-between gap-3 rounded-[1.1rem] bg-white/5 px-4 py-3.5 text-left ring-1 ring-white/10 transition-all duration-300 hover:bg-white/10 hover:ring-white/20"
      >
        <div>
          <p className="text-[0.7rem] uppercase tracking-wider text-paper/50">Password</p>
          <p className="font-mono text-lg tracking-wide text-gold-200">{password}</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all",
            copied ? "bg-teal-500 text-white" : "bg-white/10 text-paper group-hover:bg-gold-400 group-hover:text-ink",
          )}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </span>
      </button>
    </div>
  );
}
