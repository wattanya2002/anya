// Runs against a disposable local database: TEST_DATABASE_URL=postgres://.../wc_test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { ensureDefaultLocations, recordMovement, transferStock, setCountedQty, StockError } from "../../lib/inventory-core.ts";

const url = process.env.TEST_DATABASE_URL;
if (!url || !/localhost|127\.0\.0\.1/.test(url)) throw new Error("TEST_DATABASE_URL must point at a local test database");
const pool = new pg.Pool({ connectionString: url, max: 6 });
let org = "", product = "", wh = "", cab = "";

async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try { await c.query("begin"); const r = await fn(c); await c.query("commit"); return r; }
  catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
const total = async () => (await pool.query("select coalesce(sum(qty),0)::int as q from stock_balances where product_id = $1", [product])).rows[0].q;
const at = async (loc: string) => (await pool.query("select qty from stock_balances where product_id = $1 and location_id = $2", [product, loc])).rows[0]?.qty ?? 0;

before(async () => {
  org = (await pool.query("insert into organizations (name) values ('inv-test') returning id")).rows[0].id;
  await tx((c) => ensureDefaultLocations(c, org));
  await tx((c) => ensureDefaultLocations(c, org)); // idempotent
  const locs = (await pool.query("select id, kind from inventory_locations where org_id = $1", [org])).rows;
  assert.equal(locs.length, 2);
  wh = locs.find((l) => l.kind === "warehouse").id; cab = locs.find((l) => l.kind === "cabinet").id;
  product = (await pool.query("insert into products (org_id, sku, name, pack_size) values ($1, 'WATER-600', 'น้ำดื่ม 600ml', 24) returning id", [org])).rows[0].id;
});
after(async () => { await pool.query("delete from organizations where id = $1", [org]); await pool.end(); });

test("RCM acceptance: receive 24 → transfer 12 → sell 3 ⇒ cabinet 9, warehouse 12, global 21", async () => {
  await tx((c) => recordMovement(c, { orgId: org, productId: product, locationId: wh, type: "RECEIVE", qty: 24, actorUserId: null }));
  assert.equal(await total(), 24);
  await tx((c) => transferStock(c, { orgId: org, productId: product, fromLocationId: wh, toLocationId: cab, qty: 12, actorUserId: null }));
  assert.equal(await at(wh), 12); assert.equal(await at(cab), 12);
  assert.equal(await total(), 24, "transfer is not a sale");
  await tx((c) => recordMovement(c, { orgId: org, productId: product, locationId: cab, type: "SALE", qty: 3, actorUserId: null }));
  assert.equal(await at(cab), 9); assert.equal(await total(), 21);
  const sales = (await pool.query("select count(*)::int as n from stock_movements where product_id = $1 and type = 'SALE'", [product])).rows[0].n;
  assert.equal(sales, 1);
});

test("stock never goes negative; failed movement leaves no ledger row", async () => {
  const before = (await pool.query("select count(*)::int n from stock_movements where product_id = $1", [product])).rows[0].n;
  await assert.rejects(tx((c) => recordMovement(c, { orgId: org, productId: product, locationId: cab, type: "ISSUE", qty: 10, actorUserId: null })),
    (e: unknown) => e instanceof StockError && e.code === "INSUFFICIENT");
  assert.equal(await at(cab), 9);
  assert.equal((await pool.query("select count(*)::int n from stock_movements where product_id = $1", [product])).rows[0].n, before);
});

test("duplicate submit with the same idempotency key changes stock once", async () => {
  const m = { orgId: org, productId: product, locationId: wh, type: "RECEIVE" as const, qty: 5, actorUserId: null, idempotencyKey: "form-abc" };
  const a = await tx((c) => recordMovement(c, m));
  const b = await tx((c) => recordMovement(c, m));
  assert.equal(a.duplicate, false); assert.equal(b.duplicate, true);
  assert.equal(await at(wh), 17);
});

test("concurrent sales cannot oversell (row lock)", async () => {
  // cabinet has 9: fire 12 concurrent single-unit sales → exactly 9 succeed
  const results = await Promise.allSettled(Array.from({ length: 12 }, () =>
    tx((c) => recordMovement(c, { orgId: org, productId: product, locationId: cab, type: "SALE", qty: 1, actorUserId: null }))));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 9);
  assert.equal(await at(cab), 0);
});

test("count adjustment sets the counted quantity with one ADJUST row; ledger is append-only", async () => {
  const r = await tx((c) => setCountedQty(c, { orgId: org, productId: product, locationId: wh, countedQty: 15, actorUserId: null }));
  assert.ok(r); assert.equal(await at(wh), 15);
  assert.equal(await tx((c) => setCountedQty(c, { orgId: org, productId: product, locationId: wh, countedQty: 15, actorUserId: null })), null);
  await assert.rejects(pool.query("update stock_movements set qty_delta = 1 where product_id = $1", [product]), /append-only/);
});

test("movements are scoped to the organization", async () => {
  const other = (await pool.query("insert into organizations (name) values ('other') returning id")).rows[0].id;
  try {
    await assert.rejects(tx((c) => recordMovement(c, { orgId: other, productId: product, locationId: wh, type: "RECEIVE", qty: 1, actorUserId: null })),
      (e: unknown) => e instanceof StockError && e.code === "NOT_FOUND");
  } finally { await pool.query("delete from organizations where id = $1", [other]); }
});
