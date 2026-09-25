import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAllowedFolder, uploadToVps } from "@/lib/storage/vps";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // stay under Vercel's 4.5MB function body limit
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/** Uploads a file to the client's own VPS over FTP (see src/lib/storage/vps.ts).
 *  Replaces the old client-direct-to-Cloudinary flow: the browser now posts
 *  the raw file here instead of fetching a signature and uploading to a
 *  third party. Returns "/api/storage/<folder>/<filename>" — stable and
 *  directly usable as an <img src>, stored in MySQL as-is. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (!isAllowedFolder(folder)) return NextResponse.json({ error: "Bad upload target." }, { status: 400 });

  // KYC documents are staff-managed only — tenants never upload their own.
  const allowedRoles = folder === "pg360/kyc" ? ["admin", "staff"] : ["tenant", "admin", "staff"];
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (max 4MB)." }, { status: 400 });
  }

  const ext = EXT_BY_MIME[file.type] ?? (file instanceof File ? file.name.split(".").pop() : null) ?? "bin";
  const filename = `${randomUUID()}.${ext}`;
  const relativePath = `${folder}/${filename}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToVps(buffer, relativePath);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, url: `/api/storage/${relativePath}` });
}
