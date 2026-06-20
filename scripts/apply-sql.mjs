// Applies .sql files to the Supabase Postgres DB.
// Usage: PG_PASSWORD='...' node scripts/apply-sql.mjs file1.sql file2.sql
import pg from "pg";
import { readFileSync } from "node:fs";

const REF = process.env.SUPABASE_REF || "qlfltufpebcwlefvxuwz";
const REGION = process.env.SUPABASE_REGION || "ap-south-1";
const password = process.env.PG_PASSWORD;
if (!password) {
  console.error("✗ Set PG_PASSWORD");
  process.exit(1);
}
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("✗ Pass at least one .sql file");
  process.exit(1);
}

// Try direct connection first, then the IPv4 session poolers.
const candidates = [
  { host: `db.${REF}.supabase.co`, port: 5432, user: "postgres", label: "direct" },
  { host: `aws-0-${REGION}.pooler.supabase.com`, port: 5432, user: `postgres.${REF}`, label: "pooler aws-0" },
  { host: `aws-1-${REGION}.pooler.supabase.com`, port: 5432, user: `postgres.${REF}`, label: "pooler aws-1" },
];

async function connect() {
  for (const c of candidates) {
    const client = new pg.Client({
      host: c.host,
      port: c.port,
      user: c.user,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
    });
    try {
      await client.connect();
      console.log(`✓ connected via ${c.label} (${c.host})`);
      return client;
    } catch (e) {
      console.log(`… ${c.label} failed: ${e.message}`);
      try { await client.end(); } catch {}
    }
  }
  throw new Error("Could not connect to the database on any host.");
}

const client = await connect();
try {
  for (const f of files) {
    const sql = readFileSync(f, "utf8");
    console.log(`\n→ applying ${f} (${sql.length} chars)…`);
    await client.query(sql);
    console.log(`✓ applied ${f}`);
  }
  console.log("\n✓ all SQL applied.");
} catch (e) {
  console.error(`\n✗ SQL error: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
