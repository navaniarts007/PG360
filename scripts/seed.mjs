// =============================================================================
// PG360 · scripts/seed.mjs
// Creates real auth users + profiles + a demo PG with rooms/tenants/payments
// for a live Supabase project. Requires the service (secret) key.
//
//   node --env-file=.env.local scripts/seed.mjs
// Idempotent: safe to re-run.
// =============================================================================

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("✗ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "demo1234";
const ok = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};

async function ensureUser(email, fullName) {
  const created = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (!created.error && created.data?.user) return created.data.user.id;
  if (created.error && !/already|registered|exists/i.test(created.error.message)) {
    throw created.error;
  }
  // already exists — find it
  let page = 1;
  for (;;) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (data.users.length < 200) throw new Error(`Could not find existing user ${email}`);
    page += 1;
  }
}

async function findOrInsert(table, match, row) {
  const existing = ok(
    await db.from(table).select("*").match(match).limit(1),
    `select ${table}`,
  );
  if (existing.length) return existing[0];
  return ok(await db.from(table).insert(row).select().single(), `insert ${table}`);
}

async function main() {
  console.log("→ Auth users…");
  const superId = await ensureUser("owner@pg360.app", "Platform Owner");
  const adminId = await ensureUser("ravi@sunrisepg.in", "Ravi Kumar");
  const tenantId = await ensureUser("arjun@tenant.in", "Arjun Nair");

  // 1) super profile first (no FK dependency on a PG)
  console.log("→ Super-admin profile…");
  ok(
    await db.from("profiles").upsert({
      id: superId,
      role: "super_admin",
      pg_id: null,
      full_name: "Platform Owner",
    }),
    "upsert super profile",
  );

  // 2) PG account (created_by -> super profile, now present)
  console.log("→ PG account…");
  const pg = await findOrInsert(
    "pg_accounts",
    { created_by: superId, pg_name: "Sunrise Stay" },
    {
      owner_name: "Ravi Kumar",
      pg_name: "Sunrise Stay",
      mobile: "+919845012345",
      location: "Koramangala, Bengaluru",
      pg_type: "coliving",
      category: "premium",
      subscription_plan: "pro",
      subscription_expiry: "2027-04-01",
      created_by: superId,
    },
  );

  // 3) admin + tenant profiles (pg_id -> pg)
  console.log("→ Owner + tenant profiles…");
  ok(
    await db.from("profiles").upsert([
      { id: adminId, role: "admin", pg_id: pg.id, full_name: "Ravi Kumar", phone: "+919845012345" },
      { id: tenantId, role: "tenant", pg_id: pg.id, full_name: "Arjun Nair", phone: "+919812000001" },
    ]),
    "upsert member profiles",
  );

  // 4) room + tenant
  console.log("→ Room + tenant…");
  const room = await findOrInsert(
    "rooms",
    { pg_id: pg.id, room_number: "201" },
    {
      pg_id: pg.id,
      room_number: "201",
      floor: 2,
      type: "single",
      total_beds: 1,
      occupied_beds: 1,
      rent_amount: 16000,
      wifi_password: "Sunrise@201",
      amenities: ["AC", "Attached bath", "Balcony", "Smart TV"],
    },
  );
  const tenant = await findOrInsert(
    "tenants",
    { pg_id: pg.id, user_id: tenantId },
    {
      pg_id: pg.id,
      room_id: room.id,
      user_id: tenantId,
      name: "Arjun Nair",
      phone: "+919812000001",
      email: "arjun@tenant.in",
      aadhaar_number: "XXXX-XXXX-4471",
      rent_amount: 16000,
      security_deposit: 32000,
      checkin_date: "2025-04-10",
      rent_due_day: 5,
      food_plan_active: true,
    },
  );

  // 5) a payment + an issue
  console.log("→ Payment + issue…");
  await findOrInsert(
    "payments",
    { tenant_id: tenant.id, month_for: "2026-06" },
    {
      pg_id: pg.id,
      tenant_id: tenant.id,
      month_for: "2026-06",
      base_rent: 16000,
      electricity_charge: 850,
      food_charge: 3000,
      amount_paid: 19850,
      payment_mode: "upi",
      payment_date: "2026-06-04",
    },
  );
  await findOrInsert(
    "issues",
    { tenant_id: tenant.id, category: "wifi" },
    {
      pg_id: pg.id,
      tenant_id: tenant.id,
      category: "wifi",
      description: "WiFi keeps dropping every evening on the 2nd floor.",
      status: "in_progress",
    },
  );

  console.log("\n✓ Seed complete. Logins (password: demo1234):");
  console.log("   super_admin  owner@pg360.app");
  console.log("   admin        ravi@sunrisepg.in");
  console.log("   tenant       arjun@tenant.in");
}

main().catch((e) => {
  console.error("\n✗", e.message);
  process.exit(1);
});
