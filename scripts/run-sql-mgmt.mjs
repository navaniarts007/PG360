import { readFileSync } from "node:fs";
const REF = process.env.SUPABASE_REF || "qlfltufpebcwlefvxuwz";
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error("no token"); process.exit(1); }
const sql = readFileSync(process.argv[2], "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
console.log(res.status, await res.text());
