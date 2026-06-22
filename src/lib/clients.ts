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
}

/** The default PG360 product (any unrecognised host). */
export const DEFAULT_CLIENT: ClientConfig = {
  slug: "pg360",
  brandName: "PG360",
  edition: "full",
  portalEnabled: true,
};

/** Registered clients, keyed by subdomain slug. */
export const CLIENTS: Record<string, ClientConfig> = {
  gvmconforts: {
    slug: "gvmconforts",
    brandName: "GVM Comforts",
    regPrefix: "GVM",
    edition: "gvm",
    portalEnabled: false,
  },
};

/** Hosts whose first label is NOT a client slug (the root product). */
const ROOT_LABELS = new Set(["pg", "pg360", "www", "localhost", "127", "192", "app"]);

/** Resolve a client from a request host header. */
export function clientFromHost(host: string | null | undefined): ClientConfig {
  if (!host) return DEFAULT_CLIENT;
  const label = host.split(":")[0]!.split(".")[0]!.toLowerCase();
  if (ROOT_LABELS.has(label)) return DEFAULT_CLIENT;
  return CLIENTS[label] ?? DEFAULT_CLIENT;
}
