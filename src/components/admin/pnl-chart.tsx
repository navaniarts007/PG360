"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
} from "recharts";

/** Simple P&L bar chart: Billed · Collected · Expenses · Net. */
export function PnlChart({
  billed,
  collected,
  expenses,
  net,
}: {
  billed: number;
  collected: number;
  expenses: number;
  net: number;
}) {
  const data = [
    { name: "Billed", value: billed, fill: "var(--color-clay-300)" },
    { name: "Collected", value: collected, fill: "var(--color-teal-500)" },
    { name: "Expenses", value: expenses, fill: "var(--color-rose-400)" },
    { name: "Net", value: net, fill: net >= 0 ? "var(--color-gold-400)" : "var(--color-rose-500)" },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-ink-muted)", fontSize: 12, fontWeight: 600 }}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={72}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: number) =>
                `₹${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`
              }
              style={{ fill: "var(--color-ink)", fontSize: 12, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
