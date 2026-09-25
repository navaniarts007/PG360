import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAllowedFolder, downloadFromVps } from "@/lib/storage/vps";

export const runtime = "nodejs";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Serves a file uploaded to the VPS (see src/lib/storage/vps.ts), gated on
 *  a valid session — same effective bar as the Cloudinary "authenticated"
 *  URLs this replaces (a signed-in user with the link can view it; the link
 *  itself is never public/enumerable since it's a random UUID filename). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { path } = await params;
  const folder = path.slice(0, 2).join("/");
  const filename = path.slice(2).join("/");
  if (!isAllowedFolder(folder) || !filename || filename.includes("..")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const buffer = await downloadFromVps(`${folder}/${filename}`);
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
