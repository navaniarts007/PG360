// Copies all data + auth logins from the OLD (Sydney) project to the NEW
// (Mumbai) project. Idempotent (ON CONFLICT DO NOTHING) and FK/trigger-safe
// (session_replication_role = replica), so stored values like payments.total_
// amount and rooms.occupied_beds are preserved exactly, not recomputed.
//
// Usage: PG_PASSWORD='...' node scripts/copy-data.mjs
import pg from "pg";

const PASSWORD = process.env.PG_PASSWORD;
if (!PASSWORD) {
  console.error("✗ Set PG_PASSWORD");
  process.exit(1);
}

const SRC = { ref: "osjzoxahgxrogebkwvoo", region: "ap-southeast-2", label: "OLD/Sydney" };
const DST = { ref: "qlfltufpebcwlefvxuwz", region: "ap-south-1", label: "NEW/Mumbai" };

async function connect({ ref, region, label }) {
  const candidates = [
    { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
    { host: `aws-0-${region}.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
    { host: `aws-1-${region}.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  ];
  for (const c of candidates) {
    const client = new pg.Client({
      host: c.host,
      port: c.port,
      user: c.user,
      password: PASSWORD,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
    });
    try {
      await client.connect();
      console.log(`✓ ${label}: connected via ${c.host}`);
      return client;
    } catch (e) {
      console.log(`… ${label}: ${c.host} failed (${e.message})`);
      try { await client.end(); } catch {}
    }
  }
  throw new Error(`Could not connect to ${label}`);
}

async function columns(client, schema, table) {
  const { rows } = await client.query(
    `select column_name, data_type, is_generated from information_schema.columns
     where table_schema = $1 and table_name = $2 order by ordinal_position`,
    [schema, table],
  );
  return rows; // [{column_name, data_type, is_generated}]
}

function serialize(value, dataType) {
  if (value === null || value === undefined) return null;
  if (dataType === "jsonb" || dataType === "json") return JSON.stringify(value);
  return value; // arrays/strings/numbers/dates handled natively by node-postgres
}

async function copyTable(src, dst, schema, table) {
  const [srcCols, dstCols] = await Promise.all([
    columns(src, schema, table),
    columns(dst, schema, table),
  ]);
  if (dstCols.length === 0) {
    console.log(`  – ${schema}.${table}: not in destination, skipped`);
    return;
  }
  // exclude destination generated columns — they can't be written to
  const dstByName = new Map(dstCols.map((c) => [c.column_name, c]));
  const cols = srcCols
    .map((c) => c.column_name)
    .filter((n) => dstByName.has(n) && dstByName.get(n).is_generated !== "ALWAYS");
  if (cols.length === 0) return;

  const { rows } = await src.query(
    `select ${cols.map((c) => `"${c}"`).join(", ")} from "${schema}"."${table}"`,
  );
  if (rows.length === 0) {
    console.log(`  · ${schema}.${table}: 0 rows`);
    return;
  }

  const colList = cols.map((c) => `"${c}"`).join(", ");
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `insert into "${schema}"."${table}" (${colList}) values (${placeholders}) on conflict do nothing`;

  let inserted = 0;
  await dst.query("begin");
  try {
    for (const row of rows) {
      const vals = cols.map((c) => serialize(row[c], dstByName.get(c).data_type));
      const res = await dst.query(sql, vals);
      inserted += res.rowCount;
    }
    await dst.query("commit");
  } catch (e) {
    await dst.query("rollback");
    throw new Error(`${schema}.${table}: ${e.message}`);
  }
  console.log(`  ✓ ${schema}.${table}: ${inserted}/${rows.length} inserted`);
}

const src = await connect(SRC);
const dst = await connect(DST);

try {
  // Disable FK checks + triggers on the destination so order doesn't matter and
  // already-computed column values are copied verbatim.
  await dst.query("set session_replication_role = replica");

  // 1) Auth first (logins). Passwords migrate via their hashes.
  console.log("\n→ auth schema");
  await copyTable(src, dst, "auth", "users");
  await copyTable(src, dst, "auth", "identities");

  // 2) All application tables (dynamic — never misses a table).
  console.log("\n→ public schema");
  const { rows: tables } = await src.query(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`,
  );
  for (const { tablename } of tables) {
    await copyTable(src, dst, "public", tablename);
  }

  await dst.query("set session_replication_role = origin");
  console.log("\n✓ data copy complete.");
} catch (e) {
  console.error(`\n✗ ${e.message}`);
  process.exitCode = 1;
} finally {
  await src.end();
  await dst.end();
}
