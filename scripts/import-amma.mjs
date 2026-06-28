// One-off importer for Amma Mens PG (Hyderabad). Clears the test data, then
// builds floors -> rooms -> beds -> tenants from the June list CSV.
//   node --env-file=.env.local scripts/import-amma.mjs "<path-to-amma.csv>"
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const PID = "45b55c1f-b966-45ad-97bc-dac5bbfd8079"; // Amma Mens PG
const csvPath = process.argv[2];
if (!csvPath) { console.error("pass the csv path"); process.exit(1); }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---- tiny CSV parser (handles quoted fields) ----
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inq = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inq) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inq = false;
      else field += ch;
    } else if (ch === '"') inq = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch === "\r") { /* skip */ }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function parseDate(s) {
  s = (s || "").trim();
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return "2026-06-01";
  let [, mo, d, y] = m.map(Number);
  if (y < 100) y = 2000 + y; else if (y < 1000) y = 2026;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "2026-06-01";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
const num = (s) => { const n = parseInt(String(s ?? "").replace(/[^\d]/g, ""), 10); return Number.isFinite(n) ? n : 0; };

// ---- parse rooms + tenants ----
const rows = parseCSV(readFileSync(csvPath, "utf8")).slice(1); // drop header
const roomData = new Map(); // roomNo -> { share, tenants: [] }
let cur = null;
for (const r of rows) {
  const roomNo = (r[0] || "").trim();
  const name = (r[3] || "").trim();
  const phone = (r[4] || "").trim();
  if (roomNo) {
    cur = roomNo;
    roomData.set(cur, { share: (r[2] || "").trim(), tenants: [] });
  }
  if (!cur) continue;
  if (!name && !phone) continue; // skip blank/total lines
  roomData.get(cur).tenants.push({
    name: name || "Resident",
    phone,
    checkin: parseDate(r[1]),
    deposit: num(r[6]),
    fees: num(r[7]),
  });
}

const TWO = new Set(["406", "703", "704"]);
const THREE = new Set(["104", "302", "402", "405", "407", "502", "602", "607"]);
const RATE = { 2: 11000, 3: 8500, 4: 7000, 5: 7000 };
const TYPE = { 1: "single", 2: "double", 3: "triple", 4: "quad", 5: "quad" };

function shareOf(roomNo) {
  const csv = roomData.get(roomNo)?.share || "";
  const d = (csv.match(/[1-9]/) || [])[0];
  if (d) return Number(d);
  if (TWO.has(roomNo)) return 2;
  if (THREE.has(roomNo)) return 3;
  if (roomNo === "701" || roomNo === "702") return 3;
  return 4;
}

// full room inventory: floors 1-6 -> X01..X08, floor 7 -> 701..704
const allRooms = [];
for (let f = 1; f <= 6; f++) for (let n = 1; n <= 8; n++) allRooms.push(`${f}${String(n).padStart(2, "0")}`);
for (let n = 1; n <= 4; n++) allRooms.push(`7${String(n).padStart(2, "0")}`);

async function main() {
  // ---- 1) wipe existing (test) data for this PG ----
  const { data: oldTenants } = await sb.from("tenants").select("user_id").eq("pg_id", PID);
  await sb.from("tenants").delete().eq("pg_id", PID);
  await sb.from("beds").delete().eq("pg_id", PID);
  await sb.from("rooms").delete().eq("pg_id", PID);
  await sb.from("floors").delete().eq("pg_id", PID);
  for (const t of oldTenants ?? []) if (t.user_id) await sb.auth.admin.deleteUser(t.user_id).catch(() => {});
  console.log(`cleared old data (${oldTenants?.length ?? 0} tenant logins removed)`);

  // ---- 2) floors ----
  const floorId = {};
  for (let f = 1; f <= 7; f++) {
    const { data } = await sb.from("floors").insert({ pg_id: PID, name: `Floor ${f}`, sort_order: f }).select("id").single();
    floorId[f] = data.id;
  }

  let roomCount = 0, bedCount = 0, tenantCount = 0;
  for (const roomNo of allRooms) {
    const info = roomData.get(roomNo) || { tenants: [] };
    const share = shareOf(roomNo);
    const beds = Math.max(share, info.tenants.length, 1);
    const rate = RATE[share] || 7000;
    const floor = Number(roomNo[0]);

    const { data: room, error: rErr } = await sb.from("rooms").insert({
      pg_id: PID, floor_id: floorId[floor], floor, room_number: roomNo,
      type: TYPE[share] || "quad", total_beds: beds, rent_amount: rate,
    }).select("id").single();
    if (rErr) { console.error(`room ${roomNo}:`, rErr.message); continue; }
    roomCount++;

    const bedRows = Array.from({ length: beds }, (_, i) => ({
      pg_id: PID, room_id: room.id, bed_number: String(i + 1), price_per_month: rate, status: "vacant",
    }));
    const { data: bedIds } = await sb.from("beds").insert(bedRows).select("id");
    bedCount += bedIds.length;

    for (let i = 0; i < info.tenants.length; i++) {
      const t = info.tenants[i];
      const bedId = bedIds[i].id;
      const { data: tenant, error: tErr } = await sb.from("tenants").insert({
        pg_id: PID, room_id: room.id, bed_id: bedId, name: t.name, phone: t.phone,
        rent_amount: t.fees || rate, security_deposit: t.deposit, checkin_date: t.checkin, status: "active",
      }).select("id").single();
      if (tErr) { console.error(`tenant ${t.name} (${roomNo}):`, tErr.message); continue; }
      await sb.from("beds").update({ status: "occupied", current_tenant_id: tenant.id }).eq("id", bedId);
      tenantCount++;
    }
  }
  console.log(`\nDONE → rooms=${roomCount} beds=${bedCount} tenants=${tenantCount}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
