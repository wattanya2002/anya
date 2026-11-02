// Applies db/migrations/*.sql in order, each inside its own transaction.
// Uses DATABASE_URL_UNPOOLED when present (Neon direct connection), else DATABASE_URL.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const rawUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
// Pin TLS to verify-full explicitly (same as lib/db.ts).
const url = rawUrl?.replace(/([?&])sslmode=(prefer|require|verify-ca)(?=&|$)/, "$1sslmode=verify-full");
if (!url) {
  console.error("DATABASE_URL_UNPOOLED or DATABASE_URL is required");
  process.exit(1);
}
const dir = path.resolve(import.meta.dirname, "../db/migrations");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  await client.query("select pg_advisory_lock(727001)");
  const done = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations(name) values ($1)", [file]);
      await client.query("commit");
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`${file}: ${err.message}`);
    }
  }
  console.log("migrations up to date");
} finally {
  await client.query("select pg_advisory_unlock(727001)").catch(() => {});
  await client.end();
}
