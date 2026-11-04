// Runs against a disposable local database: TEST_DATABASE_URL=postgres://.../wc_test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { MANUAL_SQL } from "../../lib/calendar-sql.ts";

const url = process.env.TEST_DATABASE_URL;
if (!url || !/localhost|127\.0\.0\.1/.test(url)) throw new Error("TEST_DATABASE_URL must point at a local test database");
const pool = new pg.Pool({ connectionString: url, max: 4 });
let org = "", otherOrg = "";
const u: Record<string, string> = {};

async function addUser(key: string, role: string, o = org) {
  const id = (await pool.query("insert into users (email, display_name, password_hash) values ($1, $2, 'x') returning id", [`${key}-${Date.now()}@cal.test`, key])).rows[0].id;
  await pool.query("insert into memberships (org_id, user_id, role_key) values ($1,$2,$3)", [o, id, role]);
  u[key] = id;
}
async function ev(title: string, by: string, extra: Record<string, unknown> = {}) {
  const f = { kind: "appointment", visibility: "team", owner_user_id: null, starts_on: "2026-11-02", ends_on: "2026-11-02", org_id: org, ...extra };
  await pool.query(
    "insert into calendar_events (org_id, title, kind, starts_on, ends_on, visibility, owner_user_id, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8)",
    [f.org_id, title, f.kind, f.starts_on, f.ends_on, f.visibility, f.owner_user_id, by]);
}
async function perms(userId: string) {
  return new Set((await pool.query(
    "select rp.permission_key from memberships m join role_permissions rp on rp.role_key = m.role_key where m.user_id = $1", [userId])).rows.map((r) => r.permission_key));
}
async function visible(key: string, o = org) {
  const p = await perms(u[key]);
  const { rows } = await pool.query(MANUAL_SQL, [o, "2026-11-01", "2026-11-30", u[key], p.has("calendar.view_executive"), p.has("crm.followup"), null]);
  return rows.map((r) => r.title).sort();
}

before(async () => {
  org = (await pool.query("insert into organizations (name) values ('cal-test') returning id")).rows[0].id;
  otherOrg = (await pool.query("insert into organizations (name) values ('cal-other') returning id")).rows[0].id;
  await addUser("owner", "owner"); await addUser("exec", "executive"); await addUser("mkt", "marketing"); await addUser("inv", "inventory");
  await addUser("stranger", "owner", otherOrg);
  await ev("team", u.mkt);
  await ev("private-mkt", u.mkt, { visibility: "private" });
  await ev("private-assigned-to-inv", u.mkt, { visibility: "private", owner_user_id: u.inv });
  await ev("exec-only", u.owner, { visibility: "executive" });
  await ev("followup", u.mkt, { kind: "followup" });
  await ev("followup-assigned-to-inv", u.owner, { kind: "followup", owner_user_id: u.inv });
  await ev("weekly-from-oct", u.mkt, { starts_on: "2026-10-05", ends_on: "2026-10-05" });
  await pool.query("update calendar_events set repeat = 'weekly' where title = 'weekly-from-oct'");
  await ev("ended-in-oct", u.mkt, { starts_on: "2026-10-01", ends_on: "2026-10-03" });
  await ev("other-org", u.stranger, { org_id: otherOrg });
});
after(async () => {
  await pool.query("delete from organizations where id = any($1)", [[org, otherOrg]]);
  await pool.query("delete from users where id = any($1)", [Object.values(u)]);
  await pool.end();
});

test("visibility is enforced in SQL per role", async () => {
  assert.deepEqual(await visible("owner"), ["exec-only", "followup", "followup-assigned-to-inv", "team", "weekly-from-oct"]);
  assert.deepEqual(await visible("exec"), ["exec-only", "followup", "followup-assigned-to-inv", "team", "weekly-from-oct"]);
  assert.deepEqual(await visible("mkt"), ["followup", "followup-assigned-to-inv", "private-assigned-to-inv", "private-mkt", "team", "weekly-from-oct"]);
  assert.deepEqual(await visible("inv"), ["followup-assigned-to-inv", "private-assigned-to-inv", "team", "weekly-from-oct"]);
});

test("another organization never sees these items", async () => {
  assert.deepEqual(await visible("stranger", otherOrg), ["other-org"]);
});

test("database constraints reject inconsistent items", async () => {
  const bad = async (sql: string, params: unknown[]) => assert.rejects(pool.query(sql, params), (e: { code?: string }) => e.code === "23514");
  const base = "insert into calendar_events (org_id, title, kind, starts_on, ends_on, all_day, start_time, end_time, created_by, repeat, repeat_until, link_url) values ($1,'x','general',$2,$3,$4,$5,$6,$7,$8,$9,$10)";
  await bad(base, [org, "2026-11-05", "2026-11-04", true, null, null, u.owner, "none", null, null]); // ends before start
  await bad(base, [org, "2026-11-05", "2026-11-05", true, "10:00", null, u.owner, "none", null, null]); // all-day with a time
  await bad(base, [org, "2026-11-05", "2026-11-05", false, "10:00", "09:00", u.owner, "none", null, null]); // ends before it starts
  await bad(base, [org, "2026-11-05", "2026-11-05", true, null, null, u.owner, "none", "2026-12-01", null]); // until without repeat
  await bad(base, [org, "2026-11-05", "2026-11-05", true, null, null, u.owner, "none", null, "javascript:alert(1)"]);
  await pool.query(base, [org, "2026-11-05", "2026-11-06", false, "22:00", "02:00", u.owner, "none", null, "https://example.com"]); // overnight is fine
});

test("notification dedupe keys make alert sync idempotent", async () => {
  const q = `insert into notifications (org_id, user_id, title, dedupe_key) values ($1,$2,'โปรใกล้หมดอายุ',$3)
             on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing`;
  await pool.query(q, [org, u.owner, "promo-ending:x"]); await pool.query(q, [org, u.owner, "promo-ending:x"]);
  const n = (await pool.query("select count(*)::int as n from notifications where user_id = $1 and dedupe_key = 'promo-ending:x'", [u.owner])).rows[0].n;
  assert.equal(n, 1);
});
