import { Reveal } from "@/components/marketing/reveal";

export interface LegalSection {
  h: string;
  p: string[];
}

export function LegalDoc({
  updated,
  sections,
}: {
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <Reveal blur>
        <div className="section-shell rounded-[2rem] px-6 py-10 sm:px-10 sm:py-12">
          <p className="text-sm text-ink-muted">Last updated: {updated}</p>
          <div className="mt-8 space-y-8">
            {sections.map((s) => (
              <div key={s.h}>
                <h2 className="font-display text-2xl text-ink">{s.h}</h2>
                {s.p.map((para, j) => (
                  <p key={j} className="mt-3 text-[0.97rem] leading-7 text-ink-soft">
                    {para}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
