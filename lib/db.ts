import "server-only";
import pg from "pg";

declare global {
  var __wcPool: pg.Pool | undefined;
}

/** Pin TLS to verify-full explicitly (pg treats "require" as verify-full today but will weaken it in pg v9). */
export function pinSslMode(url: string): string {
  return url.replace(/([?&])sslmode=(prefer|require|verify-ca)(?=&|$)/, "$1sslmode=verify-full");
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  return new pg.Pool({ connectionString: pinSslMode(connectionString), max: 5, idleTimeoutMillis: 10_000 });
}

export function db(): pg.Pool {
  globalThis.__wcPool ??= createPool();
  return globalThis.__wcPool;
}

export async function withTransaction<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
