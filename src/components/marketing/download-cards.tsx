import { Apple, Download, Globe, MonitorDown, Smartphone } from "lucide-react";
import { DOWNLOADS, DOWNLOADS_READY, downloadHref } from "@/lib/site";
import { Reveal } from "@/components/marketing/reveal";

const ICON = { apk: Smartphone, exe: MonitorDown, msi: MonitorDown } as const;

export function DownloadCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {DOWNLOADS.map((d, i) => {
        const Icon = ICON[d.id] ?? Apple;
        return (
          <Reveal key={d.id} blur delay={i * 70}>
            <a
              href={downloadHref(d)}
              target="_blank"
              rel="noopener noreferrer"
              className="editorial-card hover-card group flex h-full flex-col rounded-[1.9rem] p-8"
            >
              <span className="inline-grid size-14 place-items-center rounded-2xl bg-clay-50 ring-1 ring-clay-100 transition-colors group-hover:bg-clay-100">
                <Icon className="size-7 text-clay-600" />
              </span>
              <h3 className="mt-6 font-display text-2xl leading-tight text-ink">{d.platform}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">{d.detail}</p>
              <div className="mt-auto flex items-center justify-between pt-8">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-clay-600">
                  <Download className="size-4" />
                  {DOWNLOADS_READY ? "Download" : "Get it"}
                </span>
                <span className="text-xs text-ink-muted tnum">{d.size}</span>
              </div>
            </a>
          </Reveal>
        );
      })}

      <Reveal blur delay={DOWNLOADS.length * 70} className="sm:col-span-3">
        <div className="editorial-card flex flex-col items-center gap-2 rounded-[1.65rem] p-6 text-center sm:flex-row sm:justify-center sm:gap-3 sm:text-left">
          <Globe className="size-5 text-teal-600" />
          <p className="text-sm text-ink-soft">
            Prefer no install? PG360 runs in any browser — owners and tenants just sign in.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
