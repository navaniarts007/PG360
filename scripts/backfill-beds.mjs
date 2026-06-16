// Backfill beds + rate cards from the existing room model. Idempotent.
// node --env-file=.env.local scripts/backfill-beds.mjs
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

async function main() {
  const { data: rooms } = await db.from("rooms").select("*");
  console.log(`→ ${rooms.length} rooms`);

  for (const r of rooms) {
    const amenities = (r.amenities ?? []).map((a) => a.toLowerCase());
    const ac = amenities.some((a) => a.includes("ac"));
    const bath_type = amenities.some((a) => a.includes("attached")) ? "attached" : "common";
    const name = `${cap(r.type)} Sharing${ac ? " · AC" : ""}`;

    // 1) rate card for this (type, ac, bath, price)
    const { data: rc } = await db
      .from("rate_cards")
      .upsert(
        {
          pg_id: r.pg_id,
          name,
          room_type: r.type,
          ac,
          bath_type,
          price_per_month: r.rent_amount,
          food_included: true,
        },
        { onConflict: "pg_id,room_type,ac,bath_type,price_per_month" },
      )
      .select()
      .single();

    // 2) beds for this room
    for (let i = 1; i <= r.total_beds; i++) {
      await db.from("beds").upsert(
        {
          pg_id: r.pg_id,
          room_id: r.id,
          bed_number: `${r.room_number}-${i}`,
          rate_card_id: rc?.id ?? null,
          price_per_month: r.rent_amount,
        },
        { onConflict: "room_id,bed_number", ignoreDuplicates: true },
      );
    }
  }

  // 3) assign active tenants to beds within their room
  const { data: tenants } = await db
    .from("tenants")
    .select("id, room_id, bed_id, status, created_at")
    .eq("status", "active")
    .order("created_at");
  let assigned = 0;
  for (const t of tenants) {
    if (t.bed_id || !t.room_id) continue; // already on a bed / unassigned
    const { data: bed } = await db
      .from("beds")
      .select("id")
      .eq("room_id", t.room_id)
      .eq("status", "vacant")
      .order("bed_number")
      .limit(1)
      .maybeSingle();
    if (!bed) continue;
    await db.from("beds").update({ status: "occupied", current_tenant_id: t.id }).eq("id", bed.id);
    await db.from("tenants").update({ bed_id: bed.id }).eq("id", t.id);
    assigned++;
  }

  const { count: bedCount } = await db.from("beds").select("id", { count: "exact", head: true });
  const { count: rcCount } = await db.from("rate_cards").select("id", { count: "exact", head: true });
  console.log(`✓ beds: ${bedCount}, rate_cards: ${rcCount}, tenants assigned this run: ${assigned}`);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
