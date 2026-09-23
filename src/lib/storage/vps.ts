import "server-only";
import { Client } from "basic-ftp";
import { Readable, Writable } from "node:stream";

/** File storage on the client's own VPS (OVI Panel), reached over FTP —
 *  replaces Cloudinary for this branch entirely (client-owned data, not
 *  PG360's Cloudinary account). Each call opens a short-lived connection;
 *  Vercel functions are stateless so there's no connection to keep alive
 *  between requests. See deploy/clients/shanthis-ladies-hostel/mysql/ for
 *  the rest of this client's isolated infra. */

const ALLOWED_FOLDERS = [
  "pg360/payments",
  "pg360/qr",
  "pg360/avatars",
  "pg360/kyc",
  "pg360/docs",
  "pg360/signatures",
] as const;
export type StorageFolder = (typeof ALLOWED_FOLDERS)[number];

export function isAllowedFolder(folder: string): folder is StorageFolder {
  return (ALLOWED_FOLDERS as readonly string[]).includes(folder);
}

/** Matches a "/api/storage/pg360/<folder>/<uuid>.<ext>" URL as returned by
 *  POST /api/storage/upload — used to validate values coming from the
 *  client before they're written to the database. The URL is stable and
 *  directly usable as an <img src> / <a href>; access control happens at
 *  request time in the GET route (session check), not via a signed token,
 *  so unlike the old "cld:<public_id>" markers there's no separate resolve
 *  step needed before rendering. */
export const VPS_MARKER =
  /^\/api\/storage\/pg360\/(payments|qr|avatars|kyc|docs|signatures)\/[\w-]+\.\w+$/;

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const host = process.env.VPS_FTP_HOST;
  const user = process.env.VPS_FTP_USER;
  const password = process.env.VPS_FTP_PASSWORD;
  if (!host || !user || !password) {
    throw new Error("VPS storage isn't configured (VPS_FTP_HOST/USER/PASSWORD missing).");
  }
  const client = new Client(15_000);
  try {
    await client.access({
      host,
      port: Number(process.env.VPS_FTP_PORT ?? 21),
      user,
      password,
      secure: false,
    });
    return await fn(client);
  } finally {
    client.close();
  }
}

/** Uploads a buffer to `<folder>/<filename>` on the VPS, creating the folder
 *  if it doesn't exist yet. `relativePath` must already be sanitized by the
 *  caller (no "..", fixed folder enum, generated filename — never a raw
 *  user-supplied path). */
export async function uploadToVps(buffer: Buffer, relativePath: string): Promise<void> {
  await withClient(async (client) => {
    const dir = relativePath.split("/").slice(0, -1).join("/");
    if (dir) await client.ensureDir(dir);
    await client.uploadFrom(Readable.from(buffer), relativePath.split("/").pop()!);
  });
}

/** Downloads a file from the VPS as a Buffer. Throws if it doesn't exist. */
export async function downloadFromVps(relativePath: string): Promise<Buffer> {
  return withClient(async (client) => {
    const dir = relativePath.split("/").slice(0, -1).join("/");
    const filename = relativePath.split("/").pop()!;
    if (dir) await client.cd(dir);
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk);
        cb();
      },
    });
    await client.downloadTo(sink, filename);
    return Buffer.concat(chunks);
  });
}
