import type { CapacitorConfig } from "@capacitor/cli";

/**
 * PG360 ships as a thin native wrapper around the live, server-rendered web
 * app (Next.js Server Actions + Supabase RLS run on the server, so the app
 * can't be statically bundled). The WebView loads the hosted HTTPS site;
 * `mobile/www` is only an offline fallback shell.
 */
const config: CapacitorConfig = {
  appId: "software.pg360.app",
  appName: "PG360",
  webDir: "mobile/www",
  server: {
    // Load the live deployment. Must be HTTPS — Android blocks cleartext and
    // Supabase auth cookies require Secure.
    url: "https://pg360.software",
    cleartext: false,
    // Keep auth/redirects, Supabase and Cloudinary inside the WebView.
    allowNavigation: ["pg360.software", "*.supabase.co", "*.cloudinary.com"],
  },
  android: {
    // External links (e.g. a wa.me support link) open in the system browser.
    allowMixedContent: false,
  },
};

export default config;
