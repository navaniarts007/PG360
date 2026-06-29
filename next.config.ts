import type { NextConfig } from "next";

// Hardening headers applied to every response. Kept conservative so they don't
// break the app, Cloudinary/Supabase calls, or the native (Electron/Capacitor)
// WebViews that load the same origin.
const securityHeaders = [
  // force HTTPS for 2 years (incl. subdomains) — the app is HTTPS-only
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // don't let browsers MIME-sniff responses
  { key: "X-Content-Type-Options", value: "nosniff" },
  // block click-jacking (no embedding in foreign iframes)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // don't leak full URLs to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // lock down powerful features (camera allowed for self — check-in photo)
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // don't advertise the framework/version
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
