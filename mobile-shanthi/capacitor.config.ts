import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Shanthi's Ladies Hostel ships as a thin native wrapper around the live,
 * server-rendered web app — same pattern as ../capacitor.config.ts (PG360's
 * own app). The WebView loads the hosted HTTPS site; `www` is only an
 * offline fallback shell.
 */
const config: CapacitorConfig = {
  appId: "com.shanthisladieshostel.app",
  appName: "Shanthi's Ladies Hostel",
  webDir: "www",
  server: {
    // Load the live deployment. Must be HTTPS — Android blocks cleartext and
    // the session cookie requires Secure.
    url: "https://pg360.shanthisladieshostel.com",
    cleartext: false,
    allowNavigation: ["pg360.shanthisladieshostel.com", "*.cloudinary.com"],
    // On a load failure (no network, DNS down, etc.) show the branded
    // offline screen in www/ instead of Android's default WebView error page.
    errorPath: "index.html",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
