import "server-only";
import { randomBytes, createHash } from "node:crypto";

/** A bearer token for the session cookie — CSPRNG, not MySQL's UUID() (that's
 *  version-1/time-based, not safe as a secret). Only its hash is ever stored. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
