import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { clientFromHost, type ClientConfig, type Edition } from "./clients";
import { getSession } from "./auth";
import { getPgAccount } from "./db";

/** The active white-label client for this request (resolved from the host).
 *  Request-cached so layouts/pages share one lookup. Drives BRANDING. */
export const getClient = cache(async (): Promise<ClientConfig> => {
  const h = await headers();
  // x-forwarded-host is set behind Vercel's proxy; fall back to host.
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return clientFromHost(host);
});

/** Edition/access for the current viewer, resolved from their PG account in the
 *  DB (super-admin controls it per client), with the host config as the
 *  fallback + branding source. Request-cached. */
export interface ResolvedEdition {
  edition: Edition;
  portalEnabled: boolean;
  regPrefix: string | null;
  brandName: string;
  logoSrc: string | null;
}

export const getEdition = cache(async (): Promise<ResolvedEdition> => {
  const base = await getClient();
  const session = await getSession();

  // The PG account that governs this viewer's edition: an owner/staff's active
  // property, or a tenant's own PG.
  const accountId =
    session?.role === "admin" || session?.role === "staff"
      ? session.activePropertyId
      : session?.role === "tenant"
        ? session.pg_id
        : null;

  if (accountId) {
    const acct = await getPgAccount(accountId);
    if (acct) {
      return {
        edition: acct.edition,
        portalEnabled: acct.portal_enabled,
        regPrefix: acct.reg_prefix ?? base.regPrefix ?? null,
        // Subdomain themes branding; off a branded host, fall back to PG name.
        brandName:
          base.slug !== "pg360"
            ? base.brandName
            : acct.edition === "gvm"
              ? acct.pg_name
              : base.brandName,
        logoSrc: base.logoSrc ?? null,
      };
    }
  }

  return {
    edition: base.edition,
    portalEnabled: base.portalEnabled,
    regPrefix: base.regPrefix ?? null,
    brandName: base.brandName,
    logoSrc: base.logoSrc ?? null,
  };
});
