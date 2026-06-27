"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

interface FilterDef {
  key: string; // matches a data-<key> attribute on each row
  label: string;
  options: { label: string; value: string }[]; // value "" = All
}

/** Wraps a server-rendered list/table and filters it on the client. Each row
 *  inside must carry a `data-search` attribute (space-joined searchable text)
 *  and, for each filter, a `data-<key>` attribute. No data is sent across the
 *  boundary — rows stay server-rendered, we just toggle visibility. */
export function Filterable({
  placeholder = "Search…",
  filters = [],
  className,
  children,
}: {
  placeholder?: string;
  filters?: FilterDef[];
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Record<string, string>>({});
  const [count, setCount] = useState<{ shown: number; total: number } | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-search]"));
    const term = q.trim().toLowerCase();
    let shown = 0;
    for (const r of rows) {
      const text = (r.getAttribute("data-search") ?? "").toLowerCase();
      let ok = !term || text.includes(term);
      if (ok) {
        for (const f of filters) {
          const val = active[f.key];
          if (val && r.getAttribute(`data-${f.key}`) !== val) {
            ok = false;
            break;
          }
        }
      }
      r.style.display = ok ? "" : "none";
      if (ok) shown++;
    }
    setCount({ shown, total: rows.length });
  }, [q, active, filters]);

  return (
    <div ref={ref} className={`space-y-4 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-ink outline-none focus:border-clay-400"
          />
        </div>
        {filters.map((f) => (
          <div key={f.key} className="flex gap-1.5">
            {f.options.map((o) => {
              const sel = (active[f.key] ?? "") === o.value;
              return (
                <button
                  key={o.value || "all"}
                  type="button"
                  onClick={() => setActive((s) => ({ ...s, [f.key]: o.value }))}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                    sel
                      ? "bg-clay-600 text-white"
                      : "border border-line bg-surface text-ink-soft hover:text-clay-600"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {count && (
        <p className="text-xs text-ink-muted">
          {count.shown} of {count.total}
        </p>
      )}

      {children}

      {count?.shown === 0 && count.total > 0 && (
        <p className="rounded-xl border border-line bg-paper-2/40 px-6 py-8 text-center text-sm text-ink-muted">
          No matches.
        </p>
      )}
    </div>
  );
}
