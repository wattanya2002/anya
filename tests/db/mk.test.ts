// Runs against a disposable local database: TEST_DATABASE_URL=postgres://.../wc_test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const url = process.env.TEST_DATABASE_URL;
if (!url || !/localhost|127\.0\.0\.1/.test(url)) throw new Error("TEST_DATABASE_URL must point at a local test database");
const pool = new pg.Pool({ connectionString: url, max: 4 });
let org = "", ceo = "", mkt = "", inv = "";

async function user(key: string, role: string) {
  const id = (await pool.query("insert into users (email, display_name, password_hash) values ($1, $2, 'x') returning id", [`${key}-${Date.now()}@mk.test`, key])).rows[0].id;
  await pool.query("insert into memberships (org_id, user_id, role_key) values ($1,$2,$3)", [org, id, role]);
  return id as string;
}
async function request(extra: Record<string, unknown> = {}) {
  const f = { kind: "ad", status: "pending", decided_at: null, decided_by: null, all_day: true, start_time: null, ...extra };
  return (await pool.query(
    `insert into approval_requests (org_id, kind, title, summary, decide_by, submitted_by, status, decided_at, decided_by, all_day, start_time, starts_on)
     values ($1,$2,'t','s','2026-11-12',$3,$4,$5,$6,$7,$8,$9) returning id, ref_no`,
    [org, f.kind, mkt, f.status, f.decided_at, f.decided_by, f.all_day, f.start_time, f.start_time ? "2026-11-15" : null])).rows[0];
}

before(async () => {
  org = (await pool.query("insert into organizations (name) values ('mk-test') returning id")).rows[0].id;
  ceo = await user("ceo", "owner"); mkt = await user("mkt", "marketing"); inv = await user("inv", "inventory");
});
after(async () => { await pool.query("delete from organizations where id = $1", [org]); await pool.end(); });

test("permissions: owner / executive decide; marketing views and submits; inventory has no access", async () => {
  const { rows } = await pool.query(
    "select m.user_id, array_agg(rp.permission_key order by rp.permission_key) as p from memberships m join role_permissions rp on rp.role_key = m.role_key where m.user_id = any($1) and rp.permission_key like 'approvals.%' group by 1",
    [[ceo, mkt, inv]]);
  const by = Object.fromEntries(rows.map((r) => [r.user_id, r.p]));
  assert.deepEqual(by[ceo], ["approvals.decide", "approvals.submit", "approvals.view"]);
  assert.deepEqual(by[mkt], ["approvals.submit", "approvals.view"]);
  assert.equal(by[inv], undefined);
});

test("reference numbers are unique and increasing", async () => {
  const a = await request(), b = await request();
  assert.ok(Number(b.ref_no) > Number(a.ref_no));
});

test("a decided request must carry its decision time, and a pending one must not", async () => {
  await assert.rejects(request({ status: "approved" }), /approval_requests/);
  await assert.rejects(request({ status: "pending", decided_at: new Date(), decided_by: ceo }), /approval_requests/);
  const ok = await request({ status: "approved", decided_at: new Date(), decided_by: ceo });
  assert.ok(ok.id);
});

test("all-day and start time agree", async () => {
  await assert.rejects(request({ all_day: true, start_time: "10:00" }), /approval_requests/);
  assert.ok((await request({ all_day: false, start_time: "10:00" })).id);
});

test("a retried comment with the same client key is stored once", async () => {
  const r = await request();
  const ins = () => pool.query(
    "insert into approval_events (org_id, request_id, kind, body, actor_user_id, client_key) values ($1,$2,'comment','hi',$3,'k-1') on conflict (request_id, client_key) do nothing returning id",
    [org, r.id, ceo]);
  assert.equal((await ins()).rowCount, 1);
  assert.equal((await ins()).rowCount, 0);
  const n = (await pool.query("select count(*)::int as n from approval_events where request_id = $1", [r.id])).rows[0].n;
  assert.equal(n, 1);
});

test("attachments accept https links only; people and history go with their request", async () => {
  const r = await request({ kind: "influencer" });
  await assert.rejects(pool.query("insert into approval_attachments (org_id, request_id, kind, label, url, created_by) values ($1,$2,'image','a','http://x.test/a.png',$3)", [org, r.id, mkt]));
  await pool.query("insert into approval_attachments (org_id, request_id, kind, label, url, created_by) values ($1,$2,'image','a','https://x.test/a.png',$3)", [org, r.id, mkt]);
  await pool.query("insert into approval_people (org_id, request_id, name, platform) values ($1,$2,'ครูแนน','tiktok')", [org, r.id]);
  await pool.query("insert into approval_acks (request_id, user_id) values ($1,$2)", [r.id, ceo]);
  await pool.query("delete from approval_requests where id = $1", [r.id]);
  for (const t of ["approval_attachments", "approval_people", "approval_acks"]) {
    assert.equal((await pool.query(`select count(*)::int as n from ${t} where request_id = $1`, [r.id])).rows[0].n, 0, t);
  }
});
