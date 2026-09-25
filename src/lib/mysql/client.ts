import "server-only";
import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

/** Shared connection pool — MySQL replacement for the Supabase Postgres
 *  connection used on the main product. Scoped to this client's branch only. */
export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      // DATE/DATETIME as strings (not JS Date objects) — a lot of business
      // logic (money.ts, rent.ts, this file) does Postgres-style string
      // slicing on dates ("2026-09".slice(0,7)) that assumed Supabase's
      // timestamptz-as-ISO-string behavior. `timezone: 'Z'` tells the driver
      // to treat/report datetimes as UTC on the wire.
      //
      // CAVEAT — not fully verified: this assumes the MySQL server's own
      // time_zone is UTC, so NOW()/CURRENT_TIMESTAMP store true UTC like
      // Postgres's timestamptz did. Confirm `SELECT @@global.time_zone,
      // @@session.time_zone;` on the actual OVI Panel VPS before relying on
      // this for anything timezone-sensitive (renewal reminders, invoice
      // dates) — if the server defaults to SYSTEM/local time, stored
      // timestamps will be off by the VPS's UTC offset.
      dateStrings: true,
      timezone: "Z",
      // DECIMAL/NEWDECIMAL -> JS number, not string. mysql2 returns these as
      // strings by default (avoids float precision loss) — but "150.00" + 10
      // silently concatenates instead of adding, and the app's TS types say
      // `number` throughout (PlatformInvoice.amount, Tenant.daily_rate, ...).
      // Money here is mostly stored as integer rupees already (INT columns,
      // unaffected), so the float-precision trade-off this enables is small
      // and confined to the few genuinely fractional fields (tax_percent,
      // daily_rate).
      decimalNumbers: true,
      // TINYINT(1) -> JS boolean, not 0/1. Without this, every boolean-typed
      // column (verified, is_demo, food_opt_out, ...) silently comes back as
      // a number while the app's TS types still say `boolean` — TS won't
      // catch it, only a runtime `=== true` check failing would. Fixed once
      // here instead of `!!field` at every call site across db.ts and the
      // action files.
      typeCast: (field, next) => {
        if (field.type === "TINY" && field.length === 1) {
          const s = field.string();
          return s === null ? null : s === "1";
        }
        // Real MySQL 8.0's native JSON type reports as field.type === "JSON"
        // and mysql2 would otherwise auto-parse it — but that auto-parsing
        // was never actually verified against the real target (MariaDB,
        // used for local testing, has no native JSON type and never hits
        // this branch at all). Handling it explicitly here means it's
        // correct on real MySQL regardless, rather than trusted blind.
        if (field.type === "JSON") {
          const s = field.string();
          if (s === null) return null;
          try {
            return JSON.parse(s);
          } catch {
            return s;
          }
        }
        return next();
      },
    });
  }
  return pool;
}

/** Defensive JSON-column parse for environments (MariaDB in local testing)
 *  that report JSON columns as plain strings instead of a distinct type —
 *  the typeCast above only fires on real MySQL. Pass the raw field value;
 *  returns it parsed if it was a JSON string, or unchanged if it's already
 *  an object/array (real MySQL) or genuinely absent. */
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Run a query, returning rows typed as T[]. */
export async function query<T = unknown>(
  sql: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T[]> {
  const [rows] = await getPool().query(sql, [...params]);
  return rows as T[];
}

/** Run a query expected to return at most one row. */
export async function queryOne<T = unknown>(
  sql: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export interface Tx {
  query<T = unknown>(sql: string, params?: ReadonlyArray<unknown>): Promise<T[]>;
  queryOne<T = unknown>(sql: string, params?: ReadonlyArray<unknown>): Promise<T | null>;
}

/** Run several writes atomically. The original Supabase code did multi-step
 *  creates (e.g. staff: auth user -> profile -> property_members) as separate
 *  REST calls with manual compensating cleanup on failure (delete the auth
 *  user if a later insert failed). MySQL supports real transactions, so
 *  multi-step writes use this instead — strictly more correct than replaying
 *  the manual-rollback pattern, not scope creep: a crash between steps under
 *  the old pattern left an orphaned auth user with no profile; this can't. */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const tx: Tx = {
      async query<R>(sql: string, params: ReadonlyArray<unknown> = []) {
        const [rows] = await conn.query(sql, [...params]);
        return rows as R[];
      },
      async queryOne<R>(sql: string, params: ReadonlyArray<unknown> = []) {
        const rows = await tx.query<R>(sql, params);
        return rows[0] ?? null;
      },
    };
    const result = await fn(tx);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
