import { getKycUploadSignatureAction } from "@/lib/actions/upload";

/** Upload an Aadhaar/KYC file to Cloudinary as a PRIVATE (authenticated) asset.
 *  Returns a "cld:<public_id>.<format>" marker to store on the record; the file
 *  is delivered only via signed URLs (see getKycSignedUrl). */
export async function uploadKyc(file: File): Promise<string> {
  const sig = await getKycUploadSignatureAction();
  if (!sig.ok) throw new Error(sig.error);
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", sig.apiKey);
  fd.append("timestamp", String(sig.timestamp));
  fd.append("signature", sig.signature);
  fd.append("folder", sig.folder);
  fd.append("type", "authenticated");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
    { method: "POST", body: fd },
  );
  const json = (await res.json()) as { public_id?: string; format?: string; error?: { message?: string } };
  if (!json.public_id) throw new Error(json.error?.message || "Upload failed");
  return `cld:${json.public_id}.${json.format ?? "jpg"}`;
}
