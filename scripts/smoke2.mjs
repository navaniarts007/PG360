// Phase 2 live checks: expenses, food menu/opt, bookings RLS + writes.
// node --env-file=.env.local scripts/smoke2.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function as(email) {
  const c = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: "demo1234" });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}
const admin = () => createClient(url, service, { auth: { persistSession: false } });

console.log("=== ADMIN expenses (insert + read) ===");
const a = await as("ravi@sunrisepg.in");
const exp = await a.from("expenses").insert({ category: "utilities", amount: 4200, date: "2026-06-10", description: "smoke test electricity" }).select().single();
console.log("insert expense:", exp.error?.message ?? `ok id=${exp.data.id.slice(0, 8)}`);
const exps = await a.from("expenses").select("category, amount");
console.log("read expenses:", exps.error?.message ?? JSON.stringify(exps.data));

console.log("\n=== ADMIN food_menu upsert ===");
const fm = await a.from("food_menu").upsert(
  [
    { pg_id: (await a.from("pg_accounts").select("id").limit(1).single()).data.id, day_of_week: 0, meal_type: "breakfast", description: "Idli & sambar" },
  ],
  { onConflict: "pg_id,day_of_week,meal_type" },
);
console.log("upsert menu:", fm.error?.message ?? "ok");

console.log("\n=== TENANT reads menu + opts in/out ===");
const t = await as("arjun@tenant.in");
const menu = await t.from("food_menu").select("day_of_week, meal_type, description");
console.log("tenant sees menu rows:", menu.error?.message ?? menu.data.length);
const opt = await t.from("food_opt").upsert(
  { pg_id: (await t.from("pg_accounts").select("id").limit(1).single()).data.id, tenant_id: (await t.from("tenants").select("id").limit(1).single()).data.id, date: "2026-06-16", meal_type: "dinner", opted_in: false },
  { onConflict: "tenant_id,date,meal_type" },
);
console.log("tenant opt-out write:", opt.error?.message ?? "ok");

console.log("\n=== PUBLIC booking via service + admin reads ===");
const pgId = (await admin().from("pg_accounts").select("id").eq("pg_name", "Sunrise Stay").single()).data.id;
const bk = await admin().from("bookings").insert({ pg_id: pgId, tenant_name: "Smoke Tester", phone: "+919999999999", preferred_room_type: "any" }).select().single();
console.log("public booking insert:", bk.error?.message ?? "ok");
const inbox = await a.from("bookings").select("tenant_name, status");
console.log("admin booking inbox:", inbox.error?.message ?? JSON.stringify(inbox.data));

console.log("\n=== TENANT must NOT read expenses (RLS) ===");
const teExp = await t.from("expenses").select("amount");
console.log("tenant expenses visible (should be 0):", teExp.data?.length, teExp.error?.message ?? "");

console.log("\n✓ phase 2 smoke complete");
