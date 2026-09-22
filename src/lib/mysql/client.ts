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
      dateStrings: false,
    });
  }
  return pool;
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
