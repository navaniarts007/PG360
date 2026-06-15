// Exercises the real db.ts queries against live Supabase as each role.
// node --env-file=.env.local scripts/smoke.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MONTH = new Date().toISOString().slice(0, 7);
console.log("server currentMonth():", MONTH, "\n");

async function as(email) {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: "demo1234" });
  if (error) throw new Error(`${email}: ${error.message}`);
  return c;
}

const j = (x) => JSON.stringify(x);

{
  console.log("=== ADMIN (ravi@sunrisepg.in) ===");
  const c = await as("ravi@sunrisepg.in");
  const rooms = await c.from("rooms").select("total_beds, occupied_beds");
  const tcount = await c.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active");
  const tenants = await c.from("tenants").select("*, room:rooms(room_number, floor)");
  const pays = await c.from("payments").select("*, tenant:tenants(name, room:rooms(room_number))").eq("month_for", "2026-06");
  const issues = await c.from("issues").select("*, tenant:tenants(name, room:rooms(room_number))");
  console.log("rooms:", rooms.data?.length, rooms.error?.message ?? "");
  console.log("active tenant count:", tcount.count, tcount.error?.message ?? "");
  console.log("tenants+room embed:", j(tenants.data?.map((t) => [t.name, t.room?.room_number])), tenants.error?.message ?? "");
  console.log("payments 2026-06:", j(pays.data?.map((p) => [p.tenant?.name, p.status, p.total_amount])), pays.error?.message ?? "");
  console.log("issues:", j(issues.data?.map((i) => [i.tenant?.name, i.category, i.status])), issues.error?.message ?? "");
}

{
  console.log("\n=== TENANT (arjun@tenant.in) ===");
  const c = await as("arjun@tenant.in");
  const mine = await c.from("tenants").select("*, room:rooms(*)").limit(1).maybeSingle();
  const pays = await c.from("payments").select("*").order("month_for", { ascending: false });
  const issues = await c.from("issues").select("*");
  const pg = await c.from("pg_accounts").select("*").limit(1).maybeSingle();
  console.log("my tenant:", mine.data?.name, "| room:", mine.data?.room?.room_number, "| wifi:", mine.data?.room?.wifi_password, mine.error?.message ?? "");
  console.log("my payments:", j(pays.data?.map((p) => [p.month_for, p.status])), pays.error?.message ?? "");
  console.log("my issues:", j(issues.data?.map((i) => [i.category, i.status])), issues.error?.message ?? "");
  console.log("my pg:", pg.data?.pg_name, "| owner:", pg.data?.owner_name, pg.error?.message ?? "");
  // isolation: should NOT see other tenants
  const others = await c.from("tenants").select("name");
  console.log("tenants visible to tenant (should be 1):", others.data?.length);
}

console.log("\n✓ smoke complete");
