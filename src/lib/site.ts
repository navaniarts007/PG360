/* =========================================================================
   PG360 marketing/site constants — contact details and app downloads.
   ========================================================================= */

const PHONE_DIGITS = "916383434721"; // +91 63834 34721

export const CONTACT = {
  phone: "+91 63834 34721",
  tel: `tel:+${PHONE_DIGITS}`,
  whatsapp: `https://wa.me/${PHONE_DIGITS}`,
  emails: ["contact@pg360.software", "pg360software@gmail.com"],
} as const;

const REPO = "https://github.com/navaniarts007/PG360";

/**
 * App downloads. Hosted on GitHub Releases. The `releases/latest/download/<file>`
 * URLs auto-resolve to the newest release's asset — so once the binaries are
 * uploaded to a release with these exact filenames, the buttons just work.
 *
 * Until the first release is published, set `DOWNLOADS_READY = false` and the UI
 * links to the releases page instead of a (404) direct asset.
 */
export const DOWNLOADS_READY = false;

export const RELEASES_PAGE = `${REPO}/releases/latest`;

export interface DownloadTarget {
  id: "apk" | "exe" | "msi";
  platform: string;
  detail: string;
  size: string;
  file: string;
  url: string;
}

export const DOWNLOADS: DownloadTarget[] = [
  {
    id: "apk",
    platform: "Android",
    detail: "APK · Android 7.0+",
    size: "~8 MB",
    file: "PG360.apk",
    url: `${REPO}/releases/latest/download/PG360.apk`,
  },
  {
    id: "exe",
    platform: "Windows",
    detail: "Installer (.exe)",
    size: "~78 MB",
    file: "PG360-Setup.exe",
    url: `${REPO}/releases/latest/download/PG360-Setup.exe`,
  },
  {
    id: "msi",
    platform: "Windows",
    detail: "Enterprise (.msi)",
    size: "~88 MB",
    file: "PG360-Setup.msi",
    url: `${REPO}/releases/latest/download/PG360-Setup.msi`,
  },
];

/** The href a download button should use (direct asset when ready, else the
 *  releases page so the user always lands somewhere valid). */
export function downloadHref(d: DownloadTarget): string {
  return DOWNLOADS_READY ? d.url : RELEASES_PAGE;
}

/* ----------------------------------------------------- scroll-scrub hero ---
 * A 10s video exported to a 30fps WebP frame sequence (300 frames), scrubbed by
 * scroll. Generate with `node scripts/extract-frames.mjs <video.mp4>`, then set
 * SEQUENCE.ready = true and frameCount to the number printed.
 * Frames live at public/frames/hero/0001.webp … */
export const SEQUENCE = {
  ready: false,
  frameCount: 300,
  srcFor: (i: number) => `/frames/hero/${String(i).padStart(4, "0")}.webp`,
};
