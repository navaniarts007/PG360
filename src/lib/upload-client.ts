import { getKycUploadUrlAction } from "@/lib/actions/upload";

/** Upload an Aadhaar/KYC file into the private bucket via a one-time signed URL.
 *  Returns the storage PATH to store on the record (not a public URL). */
export async function uploadKyc(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const sig = await getKycUploadUrlAction(ext);
  if (!sig.ok) throw new Error(sig.error);
  const res = await fetch(sig.signedUrl, {
    method: "PUT",
    body: file,
    headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "true" },
  });
  if (!res.ok) throw new Error("Upload failed");
  return sig.path;
}
