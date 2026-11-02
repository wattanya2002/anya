// Creates the first owner account (and organization if none exists).
// Usage: node scripts/create-owner.mjs --email you@example.com --name "คุณ..." --org "Wonder Courts"
// Prints a random temporary password once; the account is flagged to change it.
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { parseArgs } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCb);
const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" }, org: { type: "string", default: "Wonder Courts" } } });
if (!values.email || !values.name) {
  console.error("--email and --name are required");
  process.exit(1);
}
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is required"); process.exit(1); }

const password = process.env.OWNER_TEMP_PASSWORD || randomBytes(12).toString("base64url");
const salt = randomBytes(16);
const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const hash = `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("begin");
  let org = (await client.query("select id from organizations where is_demo = false order by created_at limit 1")).rows[0];
  if (!org) org = (await client.query("insert into organizations (name) values ($1) returning id", [values.org])).rows[0];
  const exists = await client.query("select id from users where email = $1", [values.email]);
  if (exists.rows[0]) throw new Error(`user ${values.email} already exists — refusing to overwrite`);
  const user = (await client.query(
    "insert into users (email, display_name, password_hash, must_change_password) values ($1, $2, $3, true) returning id",
    [values.email, values.name, hash],
  )).rows[0];
  await client.query("insert into memberships (org_id, user_id, role_key) values ($1, $2, 'owner')", [org.id, user.id]);
  await client.query(
    "insert into audit_events (org_id, actor_user_id, action, entity_type, entity_id, source) values ($1, $2::uuid, 'user.created_owner', 'user', $2::text, 'cli')",
    [org.id, user.id],
  );
  await client.query("commit");
  console.log(`owner created: ${values.email}`);
  if (!process.env.OWNER_TEMP_PASSWORD) console.log(`temporary password (shown once): ${password}`);
} catch (err) {
  await client.query("rollback");
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
