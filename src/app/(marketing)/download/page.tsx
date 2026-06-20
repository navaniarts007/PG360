import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/page-hero";
import { DownloadCards } from "@/components/marketing/download-cards";

export const metadata: Metadata = {
  title: "Download the apps",
  description:
    "Get PG360 on Android (APK) and Windows (EXE / MSI), or just use it in your browser.",
};

export default function DownloadPage() {
  return (
    <>
      <PageHero
        eyebrow="Get the app"
        title="PG360, on every"
        accent="screen"
        subtitle="Install the native app on Android and Windows, or sign in from any browser — same login, same data, hosted in India."
      />
      <section className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
        <DownloadCards />
        <p className="mt-8 text-center text-sm text-ink-muted">
          The native apps are thin, secure wrappers around the live web app — every update
          ships instantly, with no re-install needed.
        </p>
      </section>
    </>
  );
}
