import { Reveal } from "@/components/marketing/reveal";

export function PageHero({
  eyebrow,
  title,
  accent,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  /** optional Instrument-Serif italic accent appended to the title */
  accent?: string;
  subtitle?: string;
}) {
  return (
    <section className="relative px-4 pt-32 pb-6 sm:px-6 sm:pt-40">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal blur>
          <p className="eyebrow text-clay-500">{eyebrow}</p>
          <h1 className="mt-4 text-balance font-display text-4xl font-semibold leading-[1.02] tracking-tight text-ink sm:text-6xl">
            {title}
            {accent ? (
              <>
                {" "}
                <span className="font-editorial italic font-normal text-clay-600">
                  {accent}
                </span>
              </>
            ) : null}
          </h1>
          {subtitle ? (
            <p className="section-copy mx-auto mt-5">{subtitle}</p>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}
