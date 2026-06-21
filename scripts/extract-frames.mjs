// Extract a video into a numbered WebP frame sequence for the scroll-scrub hero.
// Usage:  node scripts/extract-frames.mjs <video.mp4> [outDir] [fps]
// Defaults: outDir = public/frames/hero , fps = 30
//
// Uses ffmpeg-static (no system ffmpeg needed):  npm i -D ffmpeg-static
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const video = process.argv[2];
const outDir = process.argv[3] || "public/frames/hero";
const fps = process.argv[4] || "30";

if (!video) {
  console.error("✗ Usage: node scripts/extract-frames.mjs <video.mp4> [outDir] [fps]");
  process.exit(1);
}

let ffmpeg;
try {
  ffmpeg = require("ffmpeg-static");
} catch {
  console.error("✗ Missing ffmpeg-static. Run:  npm i -D ffmpeg-static");
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// ~1280px wide, quality ~70 webp — small + crisp for a hero.
console.log(`→ extracting ${fps}fps WebP frames from ${video} → ${outDir}`);
execFileSync(
  ffmpeg,
  [
    "-i", video,
    "-vf", `fps=${fps},scale=1280:-2`,
    "-c:v", "libwebp",
    "-quality", "70",
    `${outDir}/%04d.webp`,
  ],
  { stdio: "inherit" },
);

const n = readdirSync(outDir).filter((f) => f.endsWith(".webp")).length;
console.log(`\n✓ ${n} frames written to ${outDir}`);
console.log(`Next: set SEQUENCE.frameCount = ${n} in src/lib/site.ts and mount <ScrollSequence>.`);
