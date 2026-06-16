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

const PASSWORD = "pg360";
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
  
  // If user exists, update their password to match the new default
  const { data: users } = await db.auth.admin.listUsers();
  const existing = users.users.find(u => u.email === email);
  if (existing) {
    await db.auth.admin.updateUserById(existing.id, { password: PASSWORD });
    return existing.id;
  }

  if (created.error && !/already|registered|exists/i.test(created.error.message)) {
    throw created.error;
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

  // 5) a payment (left PARTIAL to show the "amount to pay" flow) + an issue
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
      amount_paid: 12000,
      payment_mode: "upi",
      payment_date: "2026-06-04",
    },
  );
  // ensure it's partial even on re-runs (trigger recomputes status/total)
  await db.from("payments").update({ amount_paid: 12000 }).eq("tenant_id", tenant.id).eq("month_for", "2026-06");
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

  console.log("→ PG payment details (UPI + bank)…");
  await db
    .from("pg_accounts")
    .update({
      upi_id: "sunrisepg@okhdfcbank",
      bank_details: "A/c name: Sunrise Stay\nA/c no: 1234 5678 9012\nIFSC: HDFC0001234",
    })
    .eq("id", pg.id);

  // ---- Phase 2 demo data -------------------------------------------------
  console.log("→ Cleaning test artifacts…");
  await db.from("bookings").delete().eq("tenant_name", "Smoke Tester");
  await db.from("expenses").delete().in("description", ["smoke test electricity", "app-path test"]);

  console.log("→ Weekly food menu…");
  const MENU = [
    ["Idli & sambar", "Veg thali", "Chapati & paneer"],
    ["Poha", "Rajma chawal", "Roti & dal fry"],
    ["Upma", "Veg pulao & raita", "Chapati & aloo gobi"],
    ["Bread & eggs", "Curd rice & pickle", "Roti & chana masala"],
    ["Dosa & chutney", "Lemon rice", "Chapati & mixed veg"],
    ["Aloo paratha", "Veg biryani", "Roti & egg curry"],
    ["Puri & bhaji", "Chole bhature", "Khichdi & papad"],
  ];
  const menuRows = [];
  MENU.forEach((meals, day) =>
    ["breakfast", "lunch", "dinner"].forEach((meal, mi) =>
      menuRows.push({ pg_id: pg.id, day_of_week: day, meal_type: meal, description: meals[mi] }),
    ),
  );
  await db.from("food_menu").upsert(menuRows, { onConflict: "pg_id,day_of_week,meal_type" });

  console.log("→ Sample expenses…");
  for (const e of [
    { category: "salaries", amount: 25000, date: "2026-06-01", description: "Cook + cleaner salaries" },
    { category: "groceries", amount: 18400, date: "2026-06-05", description: "Monthly groceries" },
    { category: "utilities", amount: 6200, date: "2026-06-08", description: "Electricity + water" },
    { category: "maintenance", amount: 3000, date: "2026-06-11", description: "Plumber visit" },
  ]) {
    await findOrInsert("expenses", { pg_id: pg.id, date: e.date, category: e.category }, { pg_id: pg.id, added_by: adminId, ...e });
  }

  console.log("→ Sample booking requests…");
  for (const b of [
    { tenant_name: "Neha Gupta", phone: "+919811112222", preferred_room_type: "single", requested_date: "2026-07-01" },
    { tenant_name: "Sandeep Rao", phone: "+919833334444", preferred_room_type: "double", requested_date: "2026-06-25" },
  ]) {
    await findOrInsert("bookings", { pg_id: pg.id, tenant_name: b.tenant_name }, { pg_id: pg.id, ...b });
  }

  console.log("→ Sample notifications…");
  await db.from("notifications").delete().like("message", "Test:%");
  for (const n of [
    { recipient_id: adminId, recipient_type: "admin", message: "New wifi complaint from Arjun Nair", link: "/dashboard/issues" },
    { recipient_id: adminId, recipient_type: "admin", message: "New room request from Neha Gupta (single)", link: "/dashboard/bookings" },
    { recipient_id: tenantId, recipient_type: "tenant", message: "Your payment for 2026-06 was recorded.", link: "/portal/bill" },
  ]) {
    await findOrInsert("notifications", { recipient_id: n.recipient_id, message: n.message }, { pg_id: pg.id, ...n });
  }

  // ---- Multi-property (Phase A1) ----------------------------------------
  console.log("→ Multi-property: owner_id + memberships…");
  await db.from("pg_accounts").update({ owner_id: adminId }).eq("id", pg.id);
  await findOrInsert(
    "property_members",
    { property_id: pg.id, user_id: adminId },
    { property_id: pg.id, user_id: adminId, role: "admin" },
  );

  const expiry2 = new Date();
  expiry2.setFullYear(expiry2.getFullYear() + 1);
  const heights = await findOrInsert(
    "pg_accounts",
    { created_by: superId, pg_name: "Sunrise Heights" },
    {
      owner_name: "Ravi Kumar",
      pg_name: "Sunrise Heights",
      mobile: "+919845012345",
      location: "HSR Layout, Bengaluru",
      pg_type: "boys",
      category: "standard",
      subscription_plan: "pro",
      subscription_expiry: expiry2.toISOString().slice(0, 10),
      created_by: superId,
      owner_id: adminId,
    },
  );
  await findOrInsert(
    "property_members",
    { property_id: heights.id, user_id: adminId },
    { property_id: heights.id, user_id: adminId, role: "admin" },
  );
  await findOrInsert(
    "rooms",
    { pg_id: heights.id, room_number: "G1" },
    {
      pg_id: heights.id, room_number: "G1", floor: 0, type: "double",
      total_beds: 2, occupied_beds: 0, rent_amount: 9000,
      wifi_password: "Heights@G1", amenities: ["Fan", "Common bath"],
    },
  );

  // a second OWNER, to prove cross-owner isolation
  console.log("→ Second owner (Meena) + Green Nest…");
  const meenaId = await ensureUser("meena@greennest.in", "Meena Iyer");
  const greennest = await findOrInsert(
    "pg_accounts",
    { created_by: superId, pg_name: "Green Nest" },
    {
      owner_name: "Meena Iyer",
      pg_name: "Green Nest",
      mobile: "+919812233445",
      location: "Indiranagar, Bengaluru",
      pg_type: "girls",
      category: "premium",
      subscription_plan: "starter",
      subscription_expiry: expiry2.toISOString().slice(0, 10),
      created_by: superId,
      owner_id: meenaId,
    },
  );
  await db.from("profiles").upsert({
    id: meenaId, role: "admin", pg_id: greennest.id, full_name: "Meena Iyer",
  });
  await findOrInsert(
    "property_members",
    { property_id: greennest.id, user_id: meenaId },
    { property_id: greennest.id, user_id: meenaId, role: "admin" },
  );
  await findOrInsert(
    "rooms",
    { pg_id: greennest.id, room_number: "101" },
    {
      pg_id: greennest.id, room_number: "101", floor: 1, type: "single",
      total_beds: 1, occupied_beds: 0, rent_amount: 14000,
      wifi_password: "GreenNest@101", amenities: ["AC", "Attached bath"],
    },
  );

  console.log("\n✓ Seed complete. Logins (password: demo1234):");
  console.log("   super_admin  owner@pg360.app");
  console.log("   admin/owner  ravi@sunrisepg.in   (Sunrise Stay + Sunrise Heights)");
  console.log("   admin/owner  meena@greennest.in  (Green Nest)");
  console.log("   tenant       arjun@tenant.in");
}

main().catch((e) => {
  console.error("\n✗", e.message);
  process.exit(1);
});
