import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { clientFromHost, type ClientConfig } from "./clients";

/** The active white-label client for this request (resolved from the host).
 *  Request-cached so layouts/pages share one lookup. */
export const getClient = cache(async (): Promise<ClientConfig> => {
  const h = await headers();
  // x-forwarded-host is set behind Vercel's proxy; fall back to host.
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return clientFromHost(host);
});
