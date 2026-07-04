"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, PieChart as PieIcon, TrendingUp, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { inr } from "@/lib/utils";
import type { ExpenseAnalytics } from "@/lib/db";

const PALETTE = [
  "var(--color-clay-500)",
  "var(--color-teal-500)",
  "var(--color-gold-500)",
  "var(--color-rose-400)",
  "var(--color-clay-300)",
  "var(--color-teal-300)",
  "var(--color-ink-muted)",
];
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const compact = (v: number) =>
  Math.abs(v) >= 100000
    ? `₹${(v / 100000).toFixed(1)}L`
    : Math.abs(v) >= 1000
      ? `₹${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
      : `₹${v}`;

function TipBox({ rows }: { rows: { label: string; value: number; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-line bg-paper px-3 py-2 text-xs shadow-pop">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 py-0.5">
          {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}
          <span className="text-ink-muted">{cap(r.label)}</span>
          <span className="ml-auto font-semibold text-ink tnum">{inr(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function ExpensesDashboard({ a }: { a: ExpenseAnalytics }) {
  const momPct = a.prevMonth > 0 ? Math.round(((a.thisMonth - a.prevMonth) / a.prevMonth) * 100) : null;
  const up = (momPct ?? 0) > 0;
  const donut = a.categories.slice(0, 6);
  if (a.categories.length > 6) {
    const rest = a.categories.slice(6).reduce((s, c) => s + c.amount, 0);
    if (rest) donut.push({ category: "other…", amount: rest });
  }
  const colorFor = (i: number) => PALETTE[i % PALETTE.length];
  const empty = a.windowTotal === 0;

  return (
    <div className="space-y-5">
      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Wallet}
          tone="clay"
          label="This month"
          value={inr(a.thisMonth)}
          sub={
            momPct === null ? (
              "vs last month —"
            ) : (
              <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-rose-600" : "text-teal-600"}`}>
                {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {Math.abs(momPct)}% vs last month
              </span>
            )
          }
        />
        <Kpi icon={TrendingUp} tone="teal" label="6-month average" value={inr(a.avg)} sub={`${compact(a.windowTotal)} total`} />
        <Kpi
          icon={PieIcon}
          tone="gold"
          label="Top category"
          value={a.topCategory ? cap(a.topCategory.category) : "—"}
          sub={a.topCategory ? inr(a.topCategory.amount) : "no data"}
        />
        <Kpi icon={Wallet} tone="rose" label="Entries (6 mo)" value={String(a.count)} sub={`${a.categories.length} categories`} />
      </div>

      {empty ? (
        <Card className="p-8 text-center">
          <p className="font-semibold text-ink">No expense data yet</p>
          <p className="mt-1 text-sm text-ink-muted">Log a few expenses and the charts will build automatically.</p>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Monthly trend */}
          <Card className="p-5 sm:p-6 lg:col-span-2">
            <h3 className="text-lg text-ink">Monthly spend</h3>
            <p className="text-xs text-ink-muted">Last {a.monthly.length} months</p>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.monthly} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-ink-muted)", fontSize: 12, fontWeight: 600 }} />
                  <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} tick={{ fill: "var(--color-ink-muted)", fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: "var(--color-paper-2)" }}
                    content={({ active, payload }) =>
                      active && payload?.length ? <TipBox rows={[{ label: "Spend", value: Number(payload[0]!.value) }]} /> : null
                    }
                  />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={56} fill="var(--color-clay-400)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Category donut */}
          <Card className="p-5 sm:p-6">
            <h3 className="text-lg text-ink">By category</h3>
            <p className="text-xs text-ink-muted">Last 6 months</p>
            <div className="mt-2 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="var(--color-paper)">
                    {donut.map((_, i) => (
                      <Cell key={i} fill={colorFor(i)} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length
                        ? <TipBox rows={[{ label: String(payload[0]!.name), value: Number(payload[0]!.value), color: payload[0]!.payload.fill }]} />
                        : null
                    }
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(v: string) => <span className="text-xs capitalize text-ink-soft">{v}</span>}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Stacked by month */}
          <Card className="p-5 sm:p-6 lg:col-span-3">
            <h3 className="text-lg text-ink">Category breakdown by month</h3>
            <p className="text-xs text-ink-muted">Top {a.topCats.length} categories + other</p>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={a.perMonthCategory} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-ink-muted)", fontSize: 12, fontWeight: 600 }} />
                  <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} tick={{ fill: "var(--color-ink-muted)", fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: "var(--color-paper-2)" }}
                    content={({ active, payload }) =>
                      active && payload?.length
                        ? <TipBox rows={payload.filter((p) => Number(p.value) > 0).map((p) => ({ label: String(p.dataKey), value: Number(p.value), color: p.color }))} />
                        : null
                    }
                  />
                  <Legend formatter={(v: string) => <span className="text-xs capitalize text-ink-soft">{v}</span>} iconType="circle" iconSize={8} />
                  {[...a.topCats, ...(a.perMonthCategory.some((r) => "other" in r) ? ["other"] : [])].map((c, i) => (
                    <Bar key={c} dataKey={c} stackId="s" fill={colorFor(i)} radius={i === a.topCats.length ? [6, 6, 0, 0] : undefined} maxBarSize={64} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  tone: "clay" | "teal" | "gold" | "rose";
  label: string;
  value: string;
  sub: React.ReactNode;
}) {
  const t = {
    clay: "bg-clay-50 text-clay-600 ring-clay-100",
    teal: "bg-teal-50 text-teal-600 ring-teal-100",
    gold: "bg-gold-50 text-gold-600 ring-gold-100",
    rose: "bg-rose-50 text-rose-600 ring-rose-100",
  }[tone];
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${t}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-2xl font-semibold text-ink tnum">{value}</p>
        <p className="text-sm font-medium text-ink-soft">{label}</p>
        <p className="text-xs text-ink-muted">{sub}</p>
      </div>
    </div>
  );
}
