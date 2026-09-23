/** Uploads a file to the client's own VPS via /api/storage/upload (see
 *  src/app/api/storage/upload/route.ts). Returns "/api/storage/<folder>/
 *  <filename>" — a stable path, store it directly and render it directly. */
export async function uploadToStorage(file: File | string, folder: string): Promise<string> {
  const fd = new FormData();
  if (typeof file === "string") {
    // data URL (e.g. from a signature canvas) — convert to a Blob first
    const res = await fetch(file);
    fd.append("file", await res.blob(), "signature.png");
  } else {
    fd.append("file", file);
  }
  fd.append("folder", folder);
  const res = await fetch("/api/storage/upload", { method: "POST", body: fd });
  const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
  if (!json.ok || !json.url) throw new Error(json.error || "Upload failed");
  return json.url;
}

/** Upload an Aadhaar/KYC file — admin/staff only. */
export async function uploadKyc(file: File): Promise<string> {
  return uploadToStorage(file, "pg360/kyc");
}

/** Upload a signature (a File, or a canvas dataURL). */
export async function uploadSignature(file: File | string): Promise<string> {
  return uploadToStorage(file, "pg360/signatures");
}
