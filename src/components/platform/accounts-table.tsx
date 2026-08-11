"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MapPin,
  Phone,
  Search,
  Settings2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PgStatusPill } from "@/components/ui/status";
import { PgStatusToggle } from "@/components/platform/pg-status-toggle";
import { formatDate } from "@/lib/utils";
import type { PgAccount } from "@/lib/types";

const typeLabel = { boys: "Boys", girls: "Girls", coliving: "Co-living" } as const;

/** Lifetime never expires; demo shows the trial end; others the renewal date. */
function expiryLabel(pg: PgAccount): string {
  if (!pg.is_demo && pg.subscription_plan === "lifetime") return "Never";
  return formatDate(pg.subscription_expiry);
}

type StatusFilter = "all" | "active" | "suspended";
type EditionFilter = "all" | "full" | "gvm";
type BillingFilter = "all" | "paying" | "demo";
type SortKey = "owner" | "location" | "pg_type" | "subscription_plan" | "subscription_expiry" | "status";

export function AccountsTable({ pgs }: { pgs: PgAccount[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [edition, setEdition] = useState<EditionFilter>("all");
  const [billing, setBilling] = useState<BillingFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };
  const toggleOpen = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // filter properties, then group by owner (one login can run several)
  const { groups, propCount } = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = pgs.filter((pg) => {
      if (status !== "all" && pg.status !== status) return false;
      if (edition !== "all" && pg.edition !== edition) return false;
      if (billing === "demo" && !pg.is_demo) return false;
      if (billing === "paying" && pg.is_demo) return false;
      if (!term) return true;
      return (
        pg.pg_name.toLowerCase().includes(term) ||
        pg.owner_name.toLowerCase().includes(term) ||
        pg.location.toLowerCase().includes(term) ||
        pg.mobile.toLowerCase().includes(term)
      );
    });
    const byOwner = new Map<string, PgAccount[]>();
    for (const p of filtered) {
      const k = p.owner_id ?? p.id;
      const arr = byOwner.get(k) ?? [];
      arr.push(p);
      byOwner.set(k, arr);
    }
    let arr = [...byOwner.values()];
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      const val = (g: PgAccount[]) =>
        sortKey === "owner" ? g[0]!.owner_name : String(g[0]![sortKey] ?? "");
      arr = arr.sort((a, b) => val(a).localeCompare(val(b), undefined, { numeric: true }) * dir);
    }
    return { groups: arr, propCount: filtered.length };
  }, [pgs, q, status, edition, billing, sortKey, sortDir]);

  const Th = ({ label, k, align = "left" }: { label: string; k?: SortKey; align?: "left" | "right" }) => (
    <th className={`px-6 py-3.5 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>
      {k ? (
        <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-clay-600">
          {label}
          {sortKey === k ? (
            sortDir === "asc" ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5 opacity-25" />
          )}
        </button>
      ) : (
        label
      )}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search PG, owner, location or mobile…"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-ink outline-none focus:border-clay-400"
          />
        </div>
        <Pills value={status} onChange={setStatus} options={["all", "active", "suspended"]} />
        <Pills value={billing} onChange={setBilling} options={["all", "paying", "demo"]} labels={{ demo: "trial" }} />
        <Pills value={edition} onChange={setEdition} options={["all", "full", "gvm"]} labels={{ gvm: "stripped" }} />
      </div>

      <p className="text-xs text-ink-muted">
        {groups.length} owner{groups.length === 1 ? "" : "s"} · {propCount} propert{propCount === 1 ? "y" : "ies"}
      </p>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-2/40 text-xs text-ink-muted">
                <Th label="PG & owner" k="owner" />
                <Th label="Location" k="location" />
                <Th label="Type" k="pg_type" />
                <Th label="Plan" k="subscription_plan" />
                <Th label="Expires" k="subscription_expiry" />
                <Th label="Status" k="status" />
                <Th label="Action" align="right" />
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-ink-muted">
                    No accounts match.
                  </td>
                </tr>
              ) : (
                groups.map((group) => {
                  const owner = group[0]!;
                  // single-property owner → a normal row
                  if (group.length === 1) {
                    return (
                      <tr key={owner.id} className="border-b border-line last:border-0 hover:bg-paper-2/30">
                        <td className="px-6 py-4">
                          <Link href={`/platform/accounts/${owner.id}`} className="group flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-clay-50 text-clay-600 ring-1 ring-clay-100">
                              <Building2 className="size-4.5" />
                            </span>
                            <div>
                              <p className="flex items-center gap-2 font-semibold text-ink group-hover:text-clay-700">
                                {owner.pg_name}
                                {owner.is_demo && <Badge tone="gold">Trial</Badge>}
                                {owner.edition === "gvm" && <Badge tone="clay">Stripped</Badge>}
                              </p>
                              <p className="flex items-center gap-1 text-xs text-ink-muted">
                                <Phone className="size-3" /> {owner.owner_name} · {owner.mobile}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <PropCells pg={owner} />
                      </tr>
                    );
                  }

                  // multi-property owner → expandable group
                  const ownerKey = owner.owner_id!;
                  const expanded = open.has(ownerKey);
                  const active = group.filter((p) => p.status === "active").length;
                  return (
                    <Fragment key={ownerKey}>
                      <tr
                        onClick={() => toggleOpen(ownerKey)}
                        className="cursor-pointer border-b border-line bg-paper-2/20 hover:bg-paper-2/40"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-paper">
                              {expanded ? <ChevronDown className="size-4.5" /> : <ChevronRight className="size-4.5" />}
                            </span>
                            <div>
                              <p className="flex items-center gap-2 font-semibold text-ink">
                                {owner.owner_name}
                                {owner.is_demo && <Badge tone="gold">Trial</Badge>}
                                <span className="rounded-full bg-clay-50 px-1.5 py-0.5 text-xs font-semibold text-clay-600">
                                  {group.length} properties
                                </span>
                              </p>
                              <p className="flex items-center gap-1 text-xs text-ink-muted">
                                <Phone className="size-3" /> {owner.mobile}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-ink-muted">—</td>
                        <td className="px-6 py-4 text-ink-muted">—</td>
                        <td className="px-6 py-4">
                          <Badge tone={owner.is_demo ? "gold" : "clay"}>{owner.is_demo ? "demo" : owner.subscription_plan}</Badge>
                        </td>
                        <td className="px-6 py-4 text-ink-muted tnum">{expiryLabel(owner)}</td>
                        <td className="px-6 py-4 text-xs text-ink-soft">{active}/{group.length} active</td>
                        <td className="px-6 py-4 text-right text-xs font-semibold text-clay-600">
                          {expanded ? "Hide" : "Expand"}
                        </td>
                      </tr>
                      {expanded &&
                        group.map((pg) => (
                          <tr key={pg.id} className="border-b border-line last:border-0 hover:bg-paper-2/30">
                            <td className="px-6 py-3.5 pl-16">
                              <Link href={`/platform/accounts/${pg.id}`} className="group flex items-center gap-2">
                                <span className="size-1.5 rounded-full bg-clay-300" />
                                <span className="font-semibold text-ink group-hover:text-clay-700">{pg.pg_name}</span>
                                {pg.edition === "gvm" && <Badge tone="clay">Stripped</Badge>}
                              </Link>
                            </td>
                            <PropCells pg={pg} />
                          </tr>
                        ))}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** The per-property data + action cells (Location, Type, Plan, Expires, Status, Action). */
function PropCells({ pg }: { pg: PgAccount }) {
  return (
    <>
      <td className="px-6 py-4 text-ink-soft">
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5 text-ink-muted" /> {pg.location}
        </span>
      </td>
      <td className="px-6 py-4">
        <Badge tone="neutral">{typeLabel[pg.pg_type]}</Badge>
      </td>
      <td className="px-6 py-4">
        <Badge tone={pg.is_demo ? "gold" : "clay"}>{pg.is_demo ? "demo" : pg.subscription_plan}</Badge>
      </td>
      <td className="px-6 py-4 text-ink-muted tnum">{expiryLabel(pg)}</td>
      <td className="px-6 py-4">
        <PgStatusPill status={pg.status} />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/platform/accounts/${pg.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-clay-50 px-3 py-1.5 text-xs font-semibold text-clay-700 transition-colors hover:bg-clay-100"
          >
            <Settings2 className="size-3.5" /> Manage
          </Link>
          <PgStatusToggle id={pg.id} status={pg.status} />
        </div>
      </td>
    </>
  );
}

function Pills<T extends string>({
  value,
  onChange,
  options,
  labels = {},
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors ${
            value === o ? "bg-clay-600 text-white" : "border border-line bg-surface text-ink-soft hover:text-clay-600"
          }`}
        >
          {labels[o] ?? o}
        </button>
      ))}
    </div>
  );
}
