// Read-only: list login accounts (email + role + PG). Passwords are hashed and
// cannot be shown. Usage: PG_PASSWORD='...' node scripts/list-users.mjs
import pg from "pg";

const REF = "qlfltufpebcwlefvxuwz";
const REGION = "ap-south-1";
const password = process.env.PG_PASSWORD;
if (!password) { console.error("Set PG_PASSWORD"); process.exit(1); }

const candidates = [
  { host: `aws-0-${REGION}.pooler.supabase.com`, user: `postgres.${REF}` },
  { host: `aws-1-${REGION}.pooler.supabase.com`, user: `postgres.${REF}` },
];
let client;
for (const c of candidates) {
  const t = new pg.Client({ host: c.host, port: 5432, user: c.user, password, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
  try { await t.connect(); client = t; break; } catch { try { await t.end(); } catch {} }
}
if (!client) { console.error("could not connect"); process.exit(1); }

const { rows } = await client.query(
  `select u.email, p.role, p.full_name, pg.pg_name
   from public.profiles p
   join auth.users u on u.id = p.id
   left join public.pg_accounts pg on pg.id = p.pg_id
   order by p.role, u.email`,
);
console.table(rows);
await client.end();
