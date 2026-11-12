import "server-only";
import { cache } from "react";
import type { PoolClient } from "pg";
import { db, withTransaction } from "./db";
import type { CurrentUser } from "./auth";
import { normalizeSchema, type FormSchema, type Answers } from "./forms-core";
import { DEFAULT_TERMS, applicationSchema, registrationSchema } from "./kol-defaults";
import { publishVersion, filesOfSubmission, type FileMeta } from "./forms-server";
import { BUCKET_STATUSES, refFromQuery, type ApplicantStatus, type BucketKey, type CeoTab, type SortKey, type DeliverableStatus, type VisitStatus, type DeliverableTemplate } from "./kol-core";
import { randomBytes } from "node:crypto";

// ---------------------------------------------------------------- shared write helpers
export async function audit(c: PoolClient, orgId: string, actorId: string | null, action: string, entityType: string, entityId: string, before: unknown, after: unknown, source = "web") {
  await c.query(
    `insert into audit_events (org_id, actor_user_id, action, entity_type, entity_id, before, after, source) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [orgId, actorId, action, entityType, entityId, before === undefined ? null : JSON.stringify(before), after === undefined ? null : JSON.stringify(after), source]);
}

/** In-web notification to every active member holding `permission` (except the actor). Idempotent per dedupe key. */
export async function notifyPermission(c: PoolClient, orgId: string, permission: string, exceptUserId: string | null, title: string, body: string, href: string, dedupe: string) {
  const { rows } = await c.query(
    `select distinct m.user_id from memberships m join users u on u.id = m.user_id
       join role_permissions rp on rp.role_key = m.role_key and rp.permission_key = $2
      where m.org_id = $1 and u.status = 'active' and ($3::uuid is null or m.user_id <> $3::uuid)`, [orgId, permission, exceptUserId]);
  for (const r of rows) {
    await c.query(
      `insert into notifications (org_id, user_id, title, body, href, dedupe_key) values ($1,$2,$3,$4,$5,$6)
       on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing`, [orgId, r.user_id, title, body, href, `${dedupe}:${r.user_id}`]);
  }
}
export async function notifyUser(c: PoolClient, orgId: string, userId: string, title: string, body: string, href: string, dedupe: string) {
  await c.query(
    `insert into notifications (org_id, user_id, title, body, href, dedupe_key) values ($1,$2,$3,$4,$5,$6)
     on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing`, [orgId, userId, title, body, href, `${dedupe}:${userId}`]);
}

export async function logStatus(c: PoolClient, orgId: string, applicantId: string, from: string | null, to: string, actorId: string | null, kind: "user" | "applicant" | "system", note?: string | null) {
  await c.query(
    `insert into kol_status_history (org_id, applicant_id, from_status, to_status, actor_user_id, actor_kind, note) values ($1,$2,$3,$4,$5,$6,$7)`,
    [orgId, applicantId, from, to, actorId, kind, note ?? null]);
}

// ---------------------------------------------------------------- setup (idempotent)
export type KolSetup = { campaignId: string; termsId: string; applicationFormId: string; registrationFormId: string };

async function uniqueSlug(c: PoolClient, base: string): Promise<string> {
  const taken = await c.query(`select 1 from forms where slug = $1`, [base]);
  if (!taken.rows[0]) return base;
  return `${base}-${randomBytes(3).toString("hex")}`;
}

/** Creates the KOL campaign, its terms v1 and the two starting forms the first time the module is opened. */
export async function ensureKolSetup(user: CurrentUser): Promise<KolSetup> {
  const existing = await readSetup(user.orgId);
  if (existing) return existing;
  return withTransaction(async (c) => {
    await c.query(`select pg_advisory_xact_lock(727006, hashtext($1))`, [user.orgId]);
    const again = await readSetup(user.orgId, c);
    if (again) return again;
    let campaignId = (await c.query(`select campaign_id from kol_campaigns where org_id = $1 and key = 'kol'`, [user.orgId])).rows[0]?.campaign_id as string | undefined;
    if (!campaignId) {
      campaignId = (await c.query(
        `insert into campaigns (org_id, name, objective, status, created_by, owner_user_id) values ($1, $2, $3, 'live', $4, $4) returning id`,
        [user.orgId, DEFAULT_TERMS.title, "รับสมัคร KOL / Influencer รีวิว Wonder Courts", user.id])).rows[0].id as string;
      await c.query(`insert into kol_campaigns (campaign_id, org_id, key) values ($1, $2, 'kol')`, [campaignId, user.orgId]);
      await audit(c, user.orgId, user.id, "kol_campaign.created", "campaign", campaignId, null, { name: DEFAULT_TERMS.title });
    }
    let termsId = (await c.query(`select id from kol_campaign_terms where campaign_id = $1 and is_current`, [campaignId])).rows[0]?.id as string | undefined;
    if (!termsId) {
      const t = DEFAULT_TERMS;
      termsId = (await c.query(
        `insert into kol_campaign_terms (org_id, campaign_id, version_no, title, items, deliverables, credit_hours, credit_value_satang, promo_discount_bps,
                                         promo_max_uses, promo_valid_days, min_followers, deliver_within_days, created_by)
         values ($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
        [user.orgId, campaignId, t.title, t.items, JSON.stringify(t.deliverables), t.creditHours, t.creditValueSatang, t.promoDiscountBps, t.promoMaxUses,
          t.promoValidDays, t.minFollowers, t.deliverWithinDays, user.id])).rows[0].id as string;
    }
    const ids: Record<string, string> = {};
    for (const [key, purpose, title, slugBase, schema] of [
      ["kol_application", "kol_application", "สมัคร KOL / Influencers Wonder Courts", "kol-apply", applicationSchema()],
      ["kol_registration", "kol_registration", "ข้อมูล KOL/Influencers Wonder Courts", "kol-register", registrationSchema()],
    ] as const) {
      const found = (await c.query(`select id from forms where org_id = $1 and system_key = $2`, [user.orgId, key])).rows[0];
      if (found) { ids[key] = found.id; continue; }
      const s = normalizeSchema(schema);
      const formId = (await c.query(
        `insert into forms (org_id, purpose, system_key, title, slug, status, campaign_id, draft, created_by) values ($1,$2,$3,$4,$5,'draft',$6,$7,$8) returning id`,
        [user.orgId, purpose, key, title, await uniqueSlug(c, slugBase), campaignId, JSON.stringify(s), user.id])).rows[0].id as string;
      await publishVersion(c, { orgId: user.orgId, formId, schema: s, userId: user.id, termsId });
      await audit(c, user.orgId, user.id, "form.created", "form", formId, null, { title, purpose, published: 1 });
      ids[key] = formId;
    }
    return { campaignId, termsId, applicationFormId: ids.kol_application, registrationFormId: ids.kol_registration };
  });
}

/** Layout and page render in parallel: both await this per-request memo so the first visit never reads before setup commits. */
export const kolReady = cache((user: CurrentUser) => ensureKolSetup(user));

async function readSetup(orgId: string, c?: PoolClient): Promise<KolSetup | null> {
  const q = c ?? db();
  const { rows } = await q.query(
    `select k.campaign_id, t.id as terms_id,
            (select id from forms where org_id = $1 and system_key = 'kol_application') as app_id,
            (select id from forms where org_id = $1 and system_key = 'kol_registration') as reg_id
       from kol_campaigns k left join kol_campaign_terms t on t.campaign_id = k.campaign_id and t.is_current
      where k.org_id = $1 and k.key = 'kol'`, [orgId]);
  const r = rows[0];
  if (!r || !r.terms_id || !r.app_id || !r.reg_id) return null;
  return { campaignId: r.campaign_id, termsId: r.terms_id, applicationFormId: r.app_id, registrationFormId: r.reg_id };
}

// ---------------------------------------------------------------- campaign terms
export type Terms = {
  id: string; campaignId: string; versionNo: number; title: string; items: string[]; deliverables: DeliverableTemplate[]; creditHours: number;
  creditValueSatang: number; promoDiscountBps: number; promoMaxUses: number | null; promoValidDays: number | null; minFollowers: number;
  deliverWithinDays: number | null; createdAt: Date; isCurrent: boolean;
};
const toTerms = (r: Record<string, unknown>): Terms => ({
  id: r.id as string, campaignId: r.campaign_id as string, versionNo: r.version_no as number, title: r.title as string, items: r.items as string[],
  deliverables: r.deliverables as DeliverableTemplate[], creditHours: Number(r.credit_hours), creditValueSatang: Number(r.credit_value_satang),
  promoDiscountBps: r.promo_discount_bps as number, promoMaxUses: r.promo_max_uses as number | null, promoValidDays: r.promo_valid_days as number | null,
  minFollowers: r.min_followers as number, deliverWithinDays: r.deliver_within_days as number | null, createdAt: r.created_at as Date, isCurrent: r.is_current as boolean,
});
export async function currentTerms(campaignId: string, c?: PoolClient): Promise<Terms | null> {
  const { rows } = await (c ?? db()).query(`select * from kol_campaign_terms where campaign_id = $1 and is_current`, [campaignId]);
  return rows[0] ? toTerms(rows[0]) : null;
}
export async function termsById(id: string | null): Promise<Terms | null> {
  if (!id) return null;
  const { rows } = await db().query(`select * from kol_campaign_terms where id = $1`, [id]);
  return rows[0] ? toTerms(rows[0]) : null;
}
export async function termsHistory(campaignId: string): Promise<Terms[]> {
  const { rows } = await db().query(`select * from kol_campaign_terms where campaign_id = $1 order by version_no desc`, [campaignId]);
  return rows.map(toTerms);
}

// ---------------------------------------------------------------- dashboard
export async function bucketCounts(orgId: string): Promise<Record<BucketKey, number>> {
  const { rows } = await db().query(
    `select status, count(*)::int as n, count(*) filter (where first_viewed_at is null)::int as unseen
       from kol_applicants where org_id = $1 and erased_at is null group by status`, [orgId]);
  const by = new Map(rows.map((r) => [r.status as ApplicantStatus, r]));
  const sum = (ss: ApplicantStatus[]) => ss.reduce((t, s) => t + (by.get(s)?.n ?? 0), 0);
  const out = {} as Record<BucketKey, number>;
  for (const k of Object.keys(BUCKET_STATUSES) as BucketKey[]) out[k] = sum(BUCKET_STATUSES[k]);
  out.new = by.get("submitted")?.unseen ?? 0;
  return out;
}

export type SocialSummary = { platform: string; url: string | null; followers: number | null };
export type ApplicantListRow = {
  id: string; refNo: number; fullName: string; creatorName: string; status: ApplicantStatus; categories: string[]; channels: string[];
  photoFileId: string | null; createdAt: Date; firstViewedAt: Date | null; social: SocialSummary[]; maxFollowers: number;
};
const SOCIAL_AGG = `coalesce((select json_agg(json_build_object('platform', sa.platform, 'url', sa.url, 'followers', sa.followers) order by sa.followers desc nulls last)
                      from kol_social_accounts sa where sa.applicant_id = a.id), '[]'::json)`;

export async function listApplicants(orgId: string, o: { bucket: BucketKey; q: string; sort: SortKey; platform: string | null; category: string | null }): Promise<ApplicantListRow[]> {
  const args: unknown[] = [orgId, BUCKET_STATUSES[o.bucket]];
  let where = `a.org_id = $1 and a.erased_at is null and a.status = any($2)`;
  if (o.bucket === "new") where += ` and a.first_viewed_at is null`;
  if (o.q) {
    args.push(`%${o.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
    const p = args.length;
    args.push(String(refFromQuery(o.q) ?? -1)); // only a reference-shaped query matches KOL-0001 (not digits inside a name)
    where += ` and (a.full_name ilike $${p} or a.creator_name ilike $${p} or coalesce(a.line_id,'') ilike $${p} or coalesce(a.phone,'') ilike $${p}
                    or a.ref_no::text = $${args.length} or exists (select 1 from kol_social_accounts s where s.applicant_id = a.id and coalesce(s.url,'') ilike $${p}))`;
  }
  if (o.platform) { args.push(o.platform); where += ` and exists (select 1 from kol_social_accounts s where s.applicant_id = a.id and s.platform = $${args.length})`; }
  if (o.category) { args.push(o.category); where += ` and $${args.length} = any(a.categories)`; }
  const order = { newest: "a.created_at desc", oldest: "a.created_at", followers: "max_followers desc nulls last, a.created_at desc", name: "lower(a.creator_name)" }[o.sort];
  const { rows } = await db().query(
    `select a.id, a.ref_no, a.full_name, a.creator_name, a.status, a.categories, a.channels, a.photo_file_id, a.created_at, a.first_viewed_at,
            ${SOCIAL_AGG} as social,
            (select max(followers) from kol_social_accounts s where s.applicant_id = a.id) as max_followers
       from kol_applicants a where ${where} order by ${order} limit 300`, args);
  return rows.map((r) => ({
    id: r.id, refNo: r.ref_no, fullName: r.full_name, creatorName: r.creator_name, status: r.status, categories: r.categories, channels: r.channels,
    photoFileId: r.photo_file_id, createdAt: r.created_at, firstViewedAt: r.first_viewed_at, social: r.social, maxFollowers: r.max_followers ?? 0,
  }));
}

export async function filterOptions(orgId: string): Promise<{ platforms: string[]; categories: string[] }> {
  const [p, c] = await Promise.all([
    db().query(`select distinct s.platform from kol_social_accounts s where s.org_id = $1 order by 1`, [orgId]),
    db().query(`select distinct unnest(categories) as c from kol_applicants where org_id = $1 and erased_at is null order by 1`, [orgId]),
  ]);
  return { platforms: p.rows.map((r) => r.platform), categories: c.rows.map((r) => r.c) };
}

// ---------------------------------------------------------------- applicant detail
export type HistoryRow = { id: string; from: string | null; to: string; actorName: string | null; actorKind: string; note: string | null; at: Date };
export type ReviewRow = { id: string; kind: string; body: string | null; reviewerName: string; at: Date };
export type ApprovalRow = {
  id: string; roundNo: number; status: string; shortPitch: string; opinion: string; reason: string | null; highlights: string | null; cautions: string | null;
  submittedByName: string; submittedAt: Date; decision: { decision: string; note: string | null; byName: string; at: Date } | null; campaignName: string;
};
export type CommentRow = { id: string; body: string; authorId: string; authorName: string; authorRole: string; at: Date };
export type TokenRow = { id: string; purpose: "status" | "registration"; enc: string | null; expiresAt: Date; revokedAt: Date | null; lastUsedAt: Date | null; createdAt: Date };
export type ApplicantDetail = ApplicantListRow & {
  orgId: string; campaignId: string; phone: string | null; lineId: string | null; email: string | null; tennisExperience: string | null; bio: string | null; motivation: string | null;
  sampleLinks: string[]; rejectedStage: string | null; termsId: string | null; termsAcceptedAt: Date | null; statusChangedAt: Date; erasedAt: Date | null;
  submission: { id: string; refNo: number; versionNo: number; schema: FormSchema; answers: Answers; files: Record<string, FileMeta[]>; submittedAt: Date };
  history: HistoryRow[]; reviews: ReviewRow[]; approvals: ApprovalRow[]; comments: CommentRow[]; tokens: TokenRow[];
  registration: { visitDate: string | null; visitTime: string | null; coachRequired: boolean | null; membershipName: string | null; notes: string | null; submittedAt: Date; updatedAt: Date;
    submission: { id: string; versionNo: number; schema: FormSchema; answers: Answers; files: Record<string, FileMeta[]> } } | null;
  participantId: string | null;
};

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function approvalsFor(applicantIds: string[]): Promise<Map<string, ApprovalRow[]>> {
  const map = new Map<string, ApprovalRow[]>();
  if (!applicantIds.length) return map;
  const { rows } = await db().query(
    `select r.*, su.display_name as submitter, d.decision, d.note as d_note, d.decided_at as d_at, du.display_name as decider, c.name as campaign_name
       from kol_approval_requests r join users su on su.id = r.submitted_by join campaigns c on c.id = r.campaign_id
       left join kol_approval_decisions d on d.approval_request_id = r.id left join users du on du.id = d.decided_by
      where r.applicant_id = any($1) order by r.round_no`, [applicantIds]);
  for (const r of rows) {
    const list = map.get(r.applicant_id) ?? [];
    list.push({
      id: r.id, roundNo: r.round_no, status: r.status, shortPitch: r.short_pitch, opinion: r.opinion, reason: r.reason, highlights: r.highlights, cautions: r.cautions,
      submittedByName: r.submitter, submittedAt: r.submitted_at, campaignName: r.campaign_name,
      decision: r.decision ? { decision: r.decision, note: r.d_note, byName: r.decider, at: r.d_at } : null,
    });
    map.set(r.applicant_id, list);
  }
  return map;
}
export async function commentsFor(applicantIds: string[]): Promise<Map<string, CommentRow[]>> {
  const map = new Map<string, CommentRow[]>();
  if (!applicantIds.length) return map;
  const { rows } = await db().query(
    `select k.id::text as id, k.applicant_id, k.body, k.author_id, u.display_name, coalesce(r.name_th, '') as role, k.created_at
       from kol_comments k join users u on u.id = k.author_id
       left join memberships m on m.user_id = k.author_id and m.org_id = k.org_id left join roles r on r.key = m.role_key
      where k.applicant_id = any($1) order by k.created_at, k.id`, [applicantIds]);
  for (const r of rows) {
    const list = map.get(r.applicant_id) ?? [];
    list.push({ id: r.id, body: r.body, authorId: r.author_id, authorName: r.display_name, authorRole: r.role, at: r.created_at });
    map.set(r.applicant_id, list);
  }
  return map;
}
export async function historyFor(applicantIds: string[]): Promise<Map<string, HistoryRow[]>> {
  const map = new Map<string, HistoryRow[]>();
  if (!applicantIds.length) return map;
  const { rows } = await db().query(
    `select h.id::text as id, h.applicant_id, h.from_status, h.to_status, u.display_name, h.actor_kind, h.note, h.created_at
       from kol_status_history h left join users u on u.id = h.actor_user_id where h.applicant_id = any($1) order by h.created_at, h.id`, [applicantIds]);
  for (const r of rows) {
    const list = map.get(r.applicant_id) ?? [];
    list.push({ id: r.id, from: r.from_status, to: r.to_status, actorName: r.display_name, actorKind: r.actor_kind, note: r.note, at: r.created_at });
    map.set(r.applicant_id, list);
  }
  return map;
}

export async function getApplicant(orgId: string, id: string): Promise<ApplicantDetail | null> {
  if (!isUuid(id)) return null;
  const { rows } = await db().query(
    `select a.*, ${SOCIAL_AGG} as social, (select max(followers) from kol_social_accounts s where s.applicant_id = a.id) as max_followers,
            s.id as sub_id, s.ref_no as sub_ref, s.answers, s.submitted_at as sub_at, v.version_no, v.schema,
            (select id from kol_participants p where p.applicant_id = a.id order by p.created_at limit 1) as participant_id
       from kol_applicants a join form_submissions s on s.id = a.source_submission join form_versions v on v.id = s.version_id
      where a.org_id = $1 and a.id = $2`, [orgId, id]);
  const r = rows[0];
  if (!r) return null;
  const [files, hist, rev, appr, com, tok, reg] = await Promise.all([
    filesOfSubmission(r.sub_id),
    historyFor([id]),
    db().query(`select k.id::text as id, k.kind, k.body, u.display_name, k.created_at from kol_reviews k join users u on u.id = k.reviewer_id
                 where k.applicant_id = $1 order by k.created_at, k.id`, [id]),
    approvalsFor([id]),
    commentsFor([id]),
    db().query(`select id, purpose, token_enc, expires_at, revoked_at, last_used_at, created_at from kol_access_tokens where applicant_id = $1 order by created_at desc`, [id]),
    db().query(`select g.*, to_char(g.visit_date, 'YYYY-MM-DD') as vd, to_char(g.visit_time, 'HH24:MI') as vt, s.answers, v.version_no, v.schema
                  from kol_registrations g join form_submissions s on s.id = g.submission_id join form_versions v on v.id = s.version_id
                 where g.applicant_id = $1`, [id]),
  ]);
  const g = reg.rows[0];
  return {
    id: r.id, orgId: r.org_id, campaignId: r.campaign_id, refNo: r.ref_no, fullName: r.full_name, creatorName: r.creator_name, status: r.status,
    categories: r.categories, channels: r.channels, photoFileId: r.photo_file_id, createdAt: r.created_at, firstViewedAt: r.first_viewed_at,
    social: r.social, maxFollowers: r.max_followers ?? 0, phone: r.phone, lineId: r.line_id, email: r.email, tennisExperience: r.tennis_experience,
    bio: r.bio, motivation: r.motivation, sampleLinks: r.sample_links, rejectedStage: r.rejected_stage, termsId: r.terms_id, termsAcceptedAt: r.terms_accepted_at,
    statusChangedAt: r.status_changed_at, erasedAt: r.erased_at,
    submission: { id: r.sub_id, refNo: r.sub_ref, versionNo: r.version_no, schema: normalizeSchema(r.schema), answers: r.answers, files, submittedAt: r.sub_at },
    history: hist.get(id) ?? [],
    reviews: rev.rows.map((x) => ({ id: x.id, kind: x.kind, body: x.body, reviewerName: x.display_name, at: x.created_at })),
    approvals: appr.get(id) ?? [], comments: com.get(id) ?? [],
    tokens: tok.rows.map((t) => ({ id: t.id, purpose: t.purpose, enc: t.token_enc, expiresAt: t.expires_at, revokedAt: t.revoked_at, lastUsedAt: t.last_used_at, createdAt: t.created_at })),
    registration: g ? {
      visitDate: g.vd, visitTime: g.vt, coachRequired: g.coach_required, membershipName: g.membership_name, notes: g.notes, submittedAt: g.submitted_at, updatedAt: g.updated_at,
      submission: { id: g.submission_id, versionNo: g.version_no, schema: normalizeSchema(g.schema), answers: g.answers, files: await filesOfSubmission(g.submission_id) },
    } : null,
    participantId: r.participant_id,
  };
}

// ---------------------------------------------------------------- CEO inbox
export type CeoCard = {
  requestId: string; requestStatus: string; roundNo: number; submittedAt: Date; shortPitch: string; opinion: string; reason: string | null;
  highlights: string | null; cautions: string | null; submittedByName: string; campaignId: string; campaignName: string;
  decision: { decision: string; note: string | null; byName: string; at: Date } | null;
  applicant: { id: string; refNo: number; fullName: string; creatorName: string; status: ApplicantStatus; categories: string[]; channels: string[]; photoFileId: string | null;
    tennisExperience: string | null; bio: string | null; motivation: string | null; sampleLinks: string[]; createdAt: Date; social: SocialSummary[];
    sampleFiles: FileMeta[] };
  terms: Terms | null; rounds: ApprovalRow[]; comments: CommentRow[]; history: HistoryRow[];
};
export async function ceoCounts(orgId: string): Promise<Record<CeoTab, number>> {
  const { rows } = await db().query(
    `select status, count(*)::int as n from kol_approval_requests r
      where r.org_id = $1 and r.round_no = (select max(round_no) from kol_approval_requests x where x.applicant_id = r.applicant_id) group by status`, [orgId]);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  return { pending: by.pending ?? 0, approved: by.approved ?? 0, info_requested: by.info_requested ?? 0, rejected: by.rejected ?? 0,
    all: rows.reduce((s, r) => s + r.n, 0) };
}
export async function ceoInbox(orgId: string, tab: CeoTab, only?: string): Promise<CeoCard[]> {
  const args: unknown[] = [orgId];
  let where = `r.org_id = $1 and a.erased_at is null and r.round_no = (select max(round_no) from kol_approval_requests x where x.applicant_id = r.applicant_id)`;
  if (tab !== "all") { args.push(tab); where += ` and r.status = $${args.length}`; }
  if (only && isUuid(only)) { args.push(only); where += ` and r.id = $${args.length}`; }
  const order = tab === "pending" ? "r.submitted_at asc" : "coalesce(r.decided_at, r.submitted_at) desc";
  const { rows } = await db().query(
    `select r.*, su.display_name as submitter, c.name as campaign_name, d.decision, d.note as d_note, d.decided_at as d_at, du.display_name as decider,
            a.id as a_id, a.ref_no, a.full_name, a.creator_name, a.status as a_status, a.categories, a.channels, a.photo_file_id, a.tennis_experience,
            a.bio, a.motivation, a.sample_links, a.created_at as a_created, a.terms_id, a.source_submission, ${SOCIAL_AGG} as social
       from kol_approval_requests r join kol_applicants a on a.id = r.applicant_id join users su on su.id = r.submitted_by
       join campaigns c on c.id = r.campaign_id
       left join kol_approval_decisions d on d.approval_request_id = r.id left join users du on du.id = d.decided_by
      where ${where} order by ${order} limit 100`, args);
  const ids = rows.map((r) => r.a_id as string);
  const [rounds, comments, history, samples, terms] = await Promise.all([
    approvalsFor(ids), commentsFor(ids), historyFor(ids),
    ids.length ? db().query(
      `select f.id, f.file_name, f.size_bytes, f.mime, a.id as a_id from form_files f join kol_applicants a on a.source_submission = f.submission_id
        join form_versions v on v.form_id = f.form_id
        join form_fields ff on ff.version_id = v.id and ff.field_key = f.field_key and ff.maps_to = 'content.samples'
        where a.id = any($1) and f.purpose = 'answer' group by f.id, a.id order by f.created_at`, [ids]) : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    db().query(`select * from kol_campaign_terms where campaign_id = any($1) and is_current`, [[...new Set(rows.map((r) => r.campaign_id))]]),
  ]);
  const termsBy = new Map(terms.rows.map((t) => [t.campaign_id as string, toTerms(t)]));
  return rows.map((r) => ({
    requestId: r.id, requestStatus: r.status, roundNo: r.round_no, submittedAt: r.submitted_at, shortPitch: r.short_pitch, opinion: r.opinion, reason: r.reason,
    highlights: r.highlights, cautions: r.cautions, submittedByName: r.submitter, campaignId: r.campaign_id, campaignName: r.campaign_name,
    decision: r.decision ? { decision: r.decision, note: r.d_note, byName: r.decider, at: r.d_at } : null,
    applicant: {
      id: r.a_id, refNo: r.ref_no, fullName: r.full_name, creatorName: r.creator_name, status: r.a_status, categories: r.categories, channels: r.channels,
      photoFileId: r.photo_file_id, tennisExperience: r.tennis_experience, bio: r.bio, motivation: r.motivation, sampleLinks: r.sample_links,
      createdAt: r.a_created, social: r.social,
      sampleFiles: samples.rows.filter((s) => s.a_id === r.a_id).map((s) => ({ id: s.id as string, name: s.file_name as string, size: s.size_bytes as number, mime: s.mime as string })),
    },
    terms: termsBy.get(r.campaign_id) ?? null,
    rounds: rounds.get(r.a_id) ?? [], comments: comments.get(r.a_id) ?? [], history: history.get(r.a_id) ?? [],
  }));
}

// ---------------------------------------------------------------- campaign tracking
export type DeliverableRow = {
  id: string; key: string; label: string; status: DeliverableStatus; url: string | null; submittedAt: Date | null; verifiedAt: Date | null; verifiedByName: string | null;
  views: number | null; likes: number | null; comments: number | null; shares: number | null; metricsSource: string | null; metricsUpdatedAt: Date | null; note: string | null;
};
export type CreditEntry = { id: string; kind: "entitlement" | "usage" | "adjustment"; hours: number; valueSatang: number; occurredOn: string; source: string; bookingRef: string | null; note: string | null; byName: string | null; at: Date };
export type PromoRow = {
  id: string; code: string; discountBps: number; maxUses: number | null; validUntil: string | null; status: string; createdAt: Date;
  usage: { linked: boolean; promotionName: string | null; bookings: number; paidSatang: number; lastSyncedAt: Date | null };
};
export type ParticipantRow = {
  id: string; applicantId: string; refNo: number; creatorName: string; fullName: string; photoFileId: string | null; lineId: string | null; phone: string | null;
  campaignName: string; termsVersion: number; approvedAt: Date; visitDate: string | null; visitTime: string | null; visitStatus: VisitStatus; coachRequired: boolean | null;
  status: string; notes: string | null; social: SocialSummary[]; deliverables: DeliverableRow[]; credits: CreditEntry[]; promos: PromoRow[];
};

export async function listParticipants(orgId: string, only?: string): Promise<ParticipantRow[]> {
  const args: unknown[] = [orgId];
  let where = `p.org_id = $1`;
  if (only) { if (!isUuid(only)) return []; args.push(only); where += ` and p.id = $2`; }
  const { rows } = await db().query(
    `select p.*, to_char(p.visit_date, 'YYYY-MM-DD') as vd, to_char(p.visit_time, 'HH24:MI') as vt, a.ref_no, a.creator_name, a.full_name, a.photo_file_id,
            a.line_id, a.phone, c.name as campaign_name, t.version_no as terms_version, ${SOCIAL_AGG} as social
       from kol_participants p join kol_applicants a on a.id = p.applicant_id join campaigns c on c.id = p.campaign_id
       join kol_campaign_terms t on t.id = p.terms_id
      where ${where} and a.erased_at is null order by (p.status = 'active') desc, p.visit_date nulls last, p.created_at desc limit 300`, args);
  const ids = rows.map((r) => r.id as string);
  if (!ids.length) return [];
  const [del, cr, pr] = await Promise.all([
    db().query(`select d.*, u.display_name as verifier from kol_deliverables d left join users u on u.id = d.verified_by where d.participant_id = any($1) order by d.sort_order`, [ids]),
    db().query(`select k.*, to_char(k.occurred_on, 'YYYY-MM-DD') as od, u.display_name from kol_court_credits k left join users u on u.id = k.created_by
                 where k.participant_id = any($1) order by k.occurred_on, k.id`, [ids]),
    db().query(
      `select k.*, to_char(k.valid_until, 'YYYY-MM-DD') as vu, pm.id as promo_id, pm.name as promo_name,
              (select count(*)::int from bookings_imported b where b.promotion_id = pm.id and b.status = 'paid') as bookings,
              (select coalesce(sum(b.amount_satang), 0)::bigint from bookings_imported b where b.promotion_id = pm.id and b.status = 'paid') as paid,
              (select max(b.synced_at) from bookings_imported b where b.promotion_id = pm.id) as synced
         from kol_promo_codes k left join promotions pm on pm.org_id = k.org_id and pm.code = k.code
        where k.participant_id = any($1) order by k.created_at`, [ids]),
  ]);
  return rows.map((r) => ({
    id: r.id, applicantId: r.applicant_id, refNo: r.ref_no, creatorName: r.creator_name, fullName: r.full_name, photoFileId: r.photo_file_id, lineId: r.line_id, phone: r.phone,
    campaignName: r.campaign_name, termsVersion: r.terms_version, approvedAt: r.approved_at, visitDate: r.vd, visitTime: r.vt, visitStatus: r.visit_status,
    coachRequired: r.coach_required, status: r.status, notes: r.notes, social: r.social,
    deliverables: del.rows.filter((d) => d.participant_id === r.id).map((d) => ({
      id: d.id, key: d.key, label: d.label, status: d.status, url: d.url, submittedAt: d.submitted_at, verifiedAt: d.verified_at, verifiedByName: d.verifier,
      views: d.views, likes: d.likes, comments: d.comments, shares: d.shares, metricsSource: d.metrics_source, metricsUpdatedAt: d.metrics_updated_at, note: d.note,
    })),
    credits: cr.rows.filter((k) => k.participant_id === r.id).map((k) => ({
      id: String(k.id), kind: k.kind, hours: Number(k.hours), valueSatang: Number(k.value_satang), occurredOn: k.od, source: k.source, bookingRef: k.booking_ref,
      note: k.note, byName: k.display_name, at: k.created_at,
    })),
    promos: pr.rows.filter((k) => k.participant_id === r.id).map((k) => ({
      id: k.id, code: k.code, discountBps: k.discount_bps, maxUses: k.max_uses, validUntil: k.vu, status: k.status, createdAt: k.created_at,
      usage: { linked: !!k.promo_id, promotionName: k.promo_name, bookings: k.bookings ?? 0, paidSatang: Number(k.paid ?? 0), lastSyncedAt: k.synced },
    })),
  }));
}
