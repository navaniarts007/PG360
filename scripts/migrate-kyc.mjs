// Move existing Aadhaar/KYC images off public Cloudinary URLs into the PRIVATE
// Supabase Storage `kyc` bucket, update the tenant rows to the storage path, and
// delete the now-redundant public Cloudinary copies.
//
//   node --env-file=.env.local scripts/migrate-kyc.mjs
//
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("✗ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (use --env-file=.env.local)");
  process.exit(1);
}
const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const cloudKey = process.env.CLOUDINARY_API_KEY;
const cloudSecret = process.env.CLOUDINARY_API_SECRET;

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

// public_id for Cloudinary destroy, derived from a delivery URL
function publicIdFromUrl(u) {
  const m = u.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
  return m ? m[1] : null;
}

async function destroyCloudinary(u) {
  if (!cloudName || !cloudKey || !cloudSecret) return false;
  const publicId = publicIdFromUrl(u);
  if (!publicId) return false;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${cloudSecret}`)
    .digest("hex");
  const body = new URLSearchParams({ public_id: publicId, api_key: cloudKey, timestamp: String(timestamp), signature });
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  return json.result === "ok" || json.result === "not found";
}

const { data: rows, error } = await sb
  .from("tenants")
  .select("id, pg_id, aadhaar_photo_url")
  .like("aadhaar_photo_url", "https://res.cloudinary.com/%");
if (error) {
  console.error("✗ query failed:", error.message);
  process.exit(1);
}
console.log(`Found ${rows.length} KYC image(s) on Cloudinary to migrate.\n`);

let ok = 0, fail = 0;
for (const t of rows) {
  const src = t.aadhaar_photo_url;
  try {
    const ext = (src.match(/\.(\w+)(?:\?|$)/)?.[1] || "png").toLowerCase();
    const resp = await fetch(src);
    if (!resp.ok) throw new Error(`download ${resp.status}`);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const path = `${t.pg_id}/${t.id}.${ext}`;

    const up = await sb.storage.from("kyc").upload(path, bytes, {
      contentType: resp.headers.get("content-type") || `image/${ext}`,
      upsert: true,
    });
    if (up.error) throw up.error;

    const upd = await sb.from("tenants").update({ aadhaar_photo_url: path }).eq("id", t.id);
    if (upd.error) throw upd.error;

    const destroyed = await destroyCloudinary(src);
    console.log(`✓ ${t.id} → ${path}${destroyed ? " (cloudinary deleted)" : " (cloudinary NOT deleted)"}`);
    ok++;
  } catch (e) {
    console.error(`✗ ${t.id}: ${e.message}`);
    fail++;
  }
}
console.log(`\nDone. migrated=${ok} failed=${fail}`);
