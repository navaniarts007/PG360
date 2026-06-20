/** Lightweight skeleton shown instantly on route navigation (via loading.tsx)
 *  while the server component streams in — makes page changes feel immediate. */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-7" aria-hidden>
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-paper-2" />
        <div className="h-8 w-56 rounded-lg bg-paper-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-paper-2" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="h-64 rounded-2xl bg-paper-2 lg:col-span-2" />
        <div className="h-64 rounded-2xl bg-paper-2" />
      </div>
    </div>
  );
}
