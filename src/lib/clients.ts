/* =========================================================================
   White-label "editions" — one codebase, many branded clients by subdomain.
   A client is resolved from the request host (e.g. gvmconforts.pg.software);
   it controls branding, which edition (nav/feature set) renders, and whether
   the tenant portal exists. Data stays isolated per property via RLS.
   ========================================================================= */

export type Edition = "full" | "gvm";

export interface ClientConfig {
  slug: string;
  brandName: string;
  /** Optional sequential registration-number prefix (e.g. "GVM" -> GVM-0001). */
  regPrefix?: string;
  edition: Edition;
  portalEnabled: boolean;
  /** Optional white-label brand mark (falls back to the PG360 glyph). */
  logoSrc?: string;
}

/** The default PG360 product (any unrecognised host). */
export const DEFAULT_CLIENT: ClientConfig = {
  slug: "pg360",
  brandName: "PG360",
  edition: "full",
  portalEnabled: true,
};

// GVM Comforts client (custom edition). Reachable on either spelling of the
// subdomain so DNS typos don't break it.
const gvrComforts: ClientConfig = {
  slug: "gvrconforts",
  brandName: "GVR Comforts",
  regPrefix: "GVR",
  edition: "gvm",
  portalEnabled: false,
};

// Shanthi's Ladies Hostel — full edition with a tenant portal + a custom signed
// resident agreement (built in Settings, signed by the tenant on first login).
// Runs on its own VPS on a custom domain (not a *.pg360.software subdomain),
// so it's matched by full hostname below rather than by subdomain label.
const shanthi: ClientConfig = {
  slug: "shanthi",
  brandName: "Shanthi's Ladies Hostel",
  regPrefix: "SLH",
  edition: "full",
  portalEnabled: true,
  logoSrc: "/clients/shanthi-logo.png",
};

/** Registered clients, keyed by subdomain slug. */
export const CLIENTS: Record<string, ClientConfig> = {
  gvrconforts: gvrComforts,
  gvmconforts: gvrComforts, // tolerate the alternate spelling
  shanthi: shanthi,
};

/** Hosts whose first label is NOT a client slug (the root product). */
const ROOT_LABELS = new Set(["pg", "pg360", "www", "localhost", "127", "192", "app"]);

/**
 * Clients reached on a fully custom domain rather than a *.pg360.software
 * subdomain, keyed by the exact hostname (no port). Checked before the
 * subdomain-label logic below, since a domain like pg360.shanthisladieshostel.com
 * would otherwise have its first label ("pg360") mistaken for the root product.
 */
const CUSTOM_DOMAINS: Record<string, ClientConfig> = {
  "pg360.shanthisladieshostel.com": shanthi,
};

/** Resolve a client from a request host header. */
export function clientFromHost(host: string | null | undefined): ClientConfig {
  if (!host) return DEFAULT_CLIENT;
  const hostname = host.split(":")[0]!.toLowerCase();

  const custom = CUSTOM_DOMAINS[hostname];
  if (custom) return custom;

  const label = hostname.split(".")[0]!;
  if (ROOT_LABELS.has(label)) return DEFAULT_CLIENT;
  return CLIENTS[label] ?? DEFAULT_CLIENT;
}
