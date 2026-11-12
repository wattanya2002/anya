// Runs against a disposable local database: TEST_DATABASE_URL=postgres://.../wc_test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const url = process.env.TEST_DATABASE_URL;
if (!url || !/localhost|127\.0\.0\.1/.test(url)) throw new Error("TEST_DATABASE_URL must point at a local test database");
const pool = new pg.Pool({ connectionString: url, max: 6 });
let org = "", owner = "", mkt = "", ceo = "", inv = "", camp = "", terms = "", form = "", v1 = "";

async function user(key: string, role: string) {
  const id = (await pool.query("insert into users (email, display_name, password_hash) values ($1, $2, 'x') returning id", [`${key}-${Date.now()}-${Math.random()}@kol.test`, key])).rows[0].id;
  await pool.query("insert into memberships (org_id, user_id, role_key) values ($1,$2,$3)", [org, id, role]);
  return id as string;
}
async function applicant(status = "submitted") {
  const s = (await pool.query(`insert into form_submissions (org_id, form_id, version_id, answers, client_key) values ($1,$2,$3,'{"f_a":"x"}',$4) returning id`,
    [org, form, v1, `ck-${Math.random().toString(36).slice(2)}`])).rows[0].id;
  return (await pool.query(
    `insert into kol_applicants (org_id, campaign_id, source_submission, full_name, creator_name, status, rejected_stage) values ($1,$2,$3,'n','c',$4,$5) returning id`,
    [org, camp, s, status, status === "rejected" ? "screening" : null])).rows[0].id as string;
}

before(async () => {
  org = (await pool.query("insert into organizations (name) values ('kol-test') returning id")).rows[0].id;
  owner = await user("owner", "owner"); mkt = await user("mkt", "marketing"); ceo = await user("ceo", "executive"); inv = await user("inv", "inventory");
  camp = (await pool.query("insert into campaigns (org_id, name, status) values ($1, 'KOL', 'live') returning id", [org])).rows[0].id;
  await pool.query("insert into kol_campaigns (campaign_id, org_id, key) values ($1,$2,'kol')", [camp, org]);
  terms = (await pool.query(
    `insert into kol_campaign_terms (org_id, campaign_id, version_no, title, items, deliverables, credit_hours, credit_value_satang, promo_discount_bps)
     values ($1,$2,1,'t','{a}','[{"key":"ig_reels","label":"IG"}]',10,600000,3000) returning id`, [org, camp])).rows[0].id;
  form = (await pool.query(`insert into forms (org_id, purpose, title, slug, draft) values ($1,'kol_application','f',$2,'{}') returning id`,
    [org, `t-${Date.now().toString(36)}`])).rows[0].id;
  v1 = (await pool.query(`insert into form_versions (org_id, form_id, version_no, schema) values ($1,$2,1,'{"sections":[]}') returning id`, [org, form])).rows[0].id;
});
after(async () => { await pool.query("delete from organizations where id = $1", [org]); await pool.end(); });

test("permissions: Marketing reviews but cannot decide; CEO decides but cannot edit forms; inventory has none", async () => {
  const { rows } = await pool.query(
    `select m.user_id, array_agg(rp.permission_key order by rp.permission_key) as p from memberships m join role_permissions rp on rp.role_key = m.role_key
      where m.user_id = any($1) and (rp.permission_key like 'kol.%' or rp.permission_key like 'forms.%' or rp.permission_key = 'privacy.manage') group by 1`,
    [[owner, mkt, ceo, inv]]);
  const by = Object.fromEntries(rows.map((r) => [r.user_id, r.p]));
  assert.deepEqual(by[mkt], ["forms.edit_responses", "forms.manage", "forms.responses", "kol.review", "kol.view"]);
  assert.deepEqual(by[ceo], ["kol.decide", "kol.view"]);
  assert.ok(by[owner].includes("kol.decide") && by[owner].includes("privacy.manage"));
  assert.equal(by[inv], undefined);
});

test("only one pending approval request per applicant", async () => {
  const a = await applicant("pending_ceo");
  await pool.query(`insert into kol_approval_requests (org_id, applicant_id, round_no, campaign_id, short_pitch, opinion, submitted_by) values ($1,$2,1,$3,'p','o',$4)`, [org, a, camp, mkt]);
  await assert.rejects(pool.query(`insert into kol_approval_requests (org_id, applicant_id, round_no, campaign_id, short_pitch, opinion, submitted_by) values ($1,$2,2,$3,'p','o',$4)`, [org, a, camp, mkt]), /kol_approval_one_pending_uq/);
});

test("two devices approving at the same time: exactly one decision is stored", async () => {
  const a = await applicant("pending_ceo");
  const r = (await pool.query(`insert into kol_approval_requests (org_id, applicant_id, round_no, campaign_id, short_pitch, opinion, submitted_by) values ($1,$2,1,$3,'p','o',$4) returning id`, [org, a, camp, mkt])).rows[0].id;
  const decide = async () => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      const row = (await c.query(`select status from kol_approval_requests where id = $1 for update`, [r])).rows[0];
      if (row.status !== "pending") { await c.query("rollback"); return "already"; }
      await c.query(`insert into kol_approval_decisions (org_id, approval_request_id, decision, decided_by) values ($1,$2,'approved',$3)`, [org, r, ceo]);
      await c.query(`update kol_approval_requests set status = 'approved', decided_at = now() where id = $1`, [r]);
      await c.query("commit");
      return "ok";
    } catch (e) { await c.query("rollback"); return (e as Error).message; } finally { c.release(); }
  };
  const out = await Promise.all([decide(), decide(), decide()]);
  assert.equal(out.filter((x) => x === "ok").length, 1);
  assert.equal((await pool.query(`select count(*)::int as n from kol_approval_decisions where approval_request_id = $1`, [r])).rows[0].n, 1);
  await assert.rejects(pool.query(`insert into kol_approval_decisions (org_id, approval_request_id, decision, decided_by) values ($1,$2,'rejected',$3)`, [org, r, ceo]));
});

test("reject / request-info decisions need a reason; status and decided_at stay consistent", async () => {
  const a = await applicant("pending_ceo");
  const r = (await pool.query(`insert into kol_approval_requests (org_id, applicant_id, round_no, campaign_id, short_pitch, opinion, submitted_by) values ($1,$2,1,$3,'p','o',$4) returning id`, [org, a, camp, mkt])).rows[0].id;
  await assert.rejects(pool.query(`insert into kol_approval_decisions (org_id, approval_request_id, decision, note, decided_by) values ($1,$2,'rejected','  ',$3)`, [org, r, ceo]));
  await assert.rejects(pool.query(`update kol_approval_requests set status = 'approved' where id = $1`, [r])); // decided_at missing
  await assert.rejects(pool.query(`update kol_applicants set status = 'rejected' where id = $1`, [a])); // rejected needs a stage
});

test("campaign participant and its entitlement are unique per applicant (no duplicate person)", async () => {
  const a = await applicant("registered");
  const ins = () => pool.query(`insert into kol_participants (org_id, applicant_id, campaign_id, terms_id, approved_at) values ($1,$2,$3,$4,now())
                                 on conflict (applicant_id, campaign_id) do update set updated_at = now() returning id, (xmax = 0) as inserted`, [org, a, camp, terms]);
  const p1 = (await ins()).rows[0], p2 = (await ins()).rows[0];
  assert.equal(p1.id, p2.id); assert.equal(p1.inserted, true); assert.equal(p2.inserted, false);
  await pool.query(`insert into kol_court_credits (org_id, participant_id, kind, hours, value_satang, occurred_on) values ($1,$2,'entitlement',10,600000,current_date)`, [org, p1.id]);
  await assert.rejects(pool.query(`insert into kol_court_credits (org_id, participant_id, kind, hours, occurred_on) values ($1,$2,'entitlement',10,current_date)`, [org, p1.id]));
  await assert.rejects(pool.query(`insert into kol_court_credits (org_id, participant_id, kind, hours, occurred_on) values ($1,$2,'usage',-1,current_date)`, [org, p1.id]));
  await assert.rejects(pool.query(`update kol_deliverables set status = 'verified' where participant_id = $1`, [p1.id]).then(async () =>
    pool.query(`insert into kol_deliverables (org_id, participant_id, key, label, status) values ($1,$2,'x_y','X','verified')`, [org, p1.id]))); // verified needs verified_at
});

test("form versioning: answers keep their version; a submission is unique per client key; files need a submission to be attached", async () => {
  const v2 = (await pool.query(`insert into form_versions (org_id, form_id, version_no, schema) values ($1,$2,2,'{"sections":[]}') returning id`, [org, form])).rows[0].id;
  const s1 = (await pool.query(`insert into form_submissions (org_id, form_id, version_id, answers, client_key) values ($1,$2,$3,'{"f_old":"kept"}','client-key-001') returning id`, [org, form, v1])).rows[0].id;
  await pool.query(`update forms set current_version_id = $2 where id = $1`, [form, v2]);
  const row = (await pool.query(`select s.answers, v.version_no from form_submissions s join form_versions v on v.id = s.version_id where s.id = $1`, [s1])).rows[0];
  assert.equal(row.version_no, 1); assert.equal(row.answers.f_old, "kept");
  await assert.rejects(pool.query(`insert into form_submissions (org_id, form_id, version_id, answers, client_key) values ($1,$2,$3,'{}','client-key-001')`, [org, form, v2]), /form_submissions_form_id_client_key_key/);
  await assert.rejects(pool.query(`insert into form_versions (org_id, form_id, version_no, schema) values ($1,$2,2,'{}')`, [org, form])); // same version number twice
});

test("access tokens are stored only as hashes and one token maps to one applicant", async () => {
  const a = await applicant("approved");
  const h = "a".repeat(64);
  await pool.query(`insert into kol_access_tokens (org_id, applicant_id, purpose, token_hash, expires_at) values ($1,$2,'registration',$3, now() + interval '14 days')`, [org, a, h]);
  await assert.rejects(pool.query(`insert into kol_access_tokens (org_id, applicant_id, purpose, token_hash, expires_at) values ($1,$2,'registration',$3, now())`, [org, a, h]));
  await assert.rejects(pool.query(`insert into kol_access_tokens (org_id, applicant_id, purpose, token_hash, expires_at) values ($1,$2,'registration','short', now())`, [org, a]));
});
