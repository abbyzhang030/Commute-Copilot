import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA } from "./schema.js";

export interface Db {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  kind: "neon" | "pglite";
}

let db: Db | null = null;

/** Neon (Postgres over DATABASE_URL) when configured; otherwise embedded Postgres (PGlite). */
export async function getDb(): Promise<Db> {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: url, max: 5 });
    db = { kind: "neon", query: async (sql, params) => (await pool.query(sql, params)).rows };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = process.env.PGLITE_DIR ?? ".data/pglite";
    if (process.env.PGLITE_DIR !== "memory") mkdirSync(dirname(dir), { recursive: true });
    const lite = process.env.PGLITE_DIR === "memory" ? new PGlite() : new PGlite(dir);
    db = {
      kind: "pglite",
      query: async (sql, params) => (await lite.query(sql, params)).rows as any[],
    };
    (db as any).exec = (sql: string) => lite.exec(sql);
  }
  await initSchema(db);
  return db;
}

async function initSchema(d: Db) {
  const anyDb = d as any;
  if (anyDb.exec) await anyDb.exec(SCHEMA);
  else for (const stmt of SCHEMA.split(/;\s*\n/).filter((s) => s.trim())) await d.query(stmt);
}
