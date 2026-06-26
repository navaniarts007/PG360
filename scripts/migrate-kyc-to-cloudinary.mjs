// Move KYC images from the private Supabase bucket back to Cloudinary as
// AUTHENTICATED (private) assets, update tenant rows to "cld:<public_id>.<fmt>",
// and remove them from the Supabase bucket.
//
//   node --env-file=.env.local scripts/migrate-kyc-to-cloudinary.mjs
//
import { createClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from "cloudinary";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
if (!url || !serviceKey) {
  console.error("✗ Set Supabase env (use --env-file=.env.local)");
  process.exit(1);
}
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

// Supabase-path rows = not http, not cld:, has a value
const { data: rows, error } = await sb
  .from("tenants")
  .select("id, aadhaar_photo_url")
  .not("aadhaar_photo_url", "is", null)
  .not("aadhaar_photo_url", "like", "http%")
  .not("aadhaar_photo_url", "like", "cld:%");
if (error) {
  console.error("✗ query failed:", error.message);
  process.exit(1);
}
console.log(`Found ${rows.length} Supabase KYC image(s) to move to Cloudinary.\n`);

let ok = 0, fail = 0;
for (const t of rows) {
  const path = t.aadhaar_photo_url;
  try {
    const signed = await sb.storage.from("kyc").createSignedUrl(path, 120);
    if (signed.error || !signed.data) throw signed.error || new Error("sign failed");
    const resp = await fetch(signed.data.signedUrl);
    if (!resp.ok) throw new Error(`download ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    const dataUri = `data:${resp.headers.get("content-type") || "image/jpeg"};base64,${buf.toString("base64")}`;

    const up = await cloudinary.uploader.upload(dataUri, {
      folder: "pg360/kyc",
      type: "authenticated",
      resource_type: "image",
    });
    const value = `cld:${up.public_id}.${up.format}`;

    const upd = await sb.from("tenants").update({ aadhaar_photo_url: value }).eq("id", t.id);
    if (upd.error) throw upd.error;

    await sb.storage.from("kyc").remove([path]);
    console.log(`✓ ${t.id} → ${value}`);
    ok++;
  } catch (e) {
    console.error(`✗ ${t.id}: ${e.message}`);
    fail++;
  }
}
console.log(`\nDone. moved=${ok} failed=${fail}`);
