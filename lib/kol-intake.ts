import "server-only";
import type { PoolClient } from "pg";
import { db, withTransaction } from "./db";
import { allFields, extractMapped, isFileType, validateAnswers, type Answers, type FileRef, type FormSchema } from "./forms-core";
import { applicantRef, submissionRef, TRANSITIONS } from "./kol-core";
import { audit, currentTerms, logStatus, notifyPermission } from "./kol";
import { publishedById, publishedBySlug, type PublishedForm } from "./forms-server";
import { claimMatches, decryptToken, encryptToken, hashToken, newToken } from "./kol-security";

export class IntakeError extends Error {
  constructor(message: string, public fields?: Record<string, string>) { super(message); }
}

/** Moves claimed uploads onto the submission and replaces {id, claim} with stored metadata. */
async function attachFiles(c: PoolClient, form: PublishedForm, schema: FormSchema, answers: Answers, submissionId: string): Promise<Answers> {
  const out: Answers = { ...answers };
  for (const f of allFields(schema)) {
    if (!isFileType(f.type) || !Array.isArray(answers[f.key])) continue;
    const refs = answers[f.key] as FileRef[];
    const stored: FileRef[] = [];
    for (const ref of refs) {
      const row = (await c.query(
        `select id, file_name, size_bytes, mime, claim_hash, submission_id from form_files where id = $1 and form_id = $2 and field_key = $3 and purpose = 'answer' for update`,
        [ref.id, form.formId, f.key])).rows[0];
      if (!row || row.submission_id || !ref.claim || !claimMatches(ref.claim, row.claim_hash)) {
        throw new IntakeError("ไฟล์แนบบางรายการหมดอายุหรือไม่ถูกต้อง กรุณาอัปโหลดใหม่", { [f.key]: "กรุณาอัปโหลดไฟล์ใหม่อีกครั้ง" });
      }
      if (f.type === "image" && !row.mime.startsWith("image/")) throw new IntakeError("ช่องนี้รับเฉพาะรูปภาพ", { [f.key]: "รับเฉพาะรูปภาพ" });
      await c.query(`update form_files set submission_id = $2, attached_at = now(), claim_hash = null where id = $1`, [row.id, submissionId]);
      stored.push({ id: row.id, name: row.file_name, size: row.size_bytes, mime: row.mime });
    }
    out[f.key] = stored;
  }
  return out;
}

type Meta = { ipHash: string; userAgent: string | null };

/** Two requests with the same client key (double tap, retry) run one after the other, so the second sees the first. */
async function lockClientKey(c: PoolClient, formId: string, clientKey: string) {
  await c.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [`form-submit:${formId}:${clientKey}`]);
}

/** STEP 1 / general public form. Idempotent per client key: a double tap returns the first result. */
export async function submitPublicForm(o: { slug: string; versionId: string; termsId: string | null; clientKey: string; raw: Record<string, unknown>; meta: Meta; baseUrl: string }):
  Promise<{ ref: string; statusUrl: string | null; successTitle: string; successMessage: string }> {
  const form = await publishedBySlug(o.slug);
  if (!form || form.purpose === "kol_registration") throw new IntakeError("ไม่พบแบบฟอร์มนี้");
  if (form.status !== "published") throw new IntakeError("แบบฟอร์มนี้ปิดรับข้อมูลแล้ว");
  if (form.versionId !== o.versionId) throw new IntakeError("แบบฟอร์มมีการปรับปรุงระหว่างที่กรอก ข้อมูลที่กรอกยังอยู่ กรุณาตรวจสอบอีกครั้งแล้วกดส่ง", { $reload: "1" });
  const { answers, errors } = validateAnswers(form.schema, o.raw);
  if (Object.keys(errors).length) throw new IntakeError("ยังมีช่องที่ต้องแก้ไข", errors);

  return withTransaction(async (c) => {
    await lockClientKey(c, form.formId, o.clientKey);
    const dup = (await c.query(`select s.ref_no, s.applicant_id, a.ref_no as a_ref from form_submissions s left join kol_applicants a on a.id = s.applicant_id
                                 where s.form_id = $1 and s.client_key = $2`, [form.formId, o.clientKey])).rows[0];
    if (dup) {
      // The same tap/retry gets the same result, including the applicant's status link.
      const tok = dup.applicant_id ? decryptToken((await c.query(
        `select token_enc from kol_access_tokens where applicant_id = $1 and purpose = 'status' and revoked_at is null and expires_at > now()
          order by created_at desc limit 1`, [dup.applicant_id])).rows[0]?.token_enc ?? null) : null;
      return { ref: dup.a_ref ? applicantRef(dup.a_ref) : submissionRef(dup.ref_no), statusUrl: tok ? `${o.baseUrl}/s/${tok}` : null,
        successTitle: form.schema.settings.successTitle, successMessage: form.schema.settings.successMessage };
    }
    let terms = null as Awaited<ReturnType<typeof currentTerms>>;
    if (form.purpose === "kol_application") {
      if (!form.campaignId) throw new IntakeError("แบบฟอร์มยังไม่ได้ผูกกับแคมเปญ");
      terms = await currentTerms(form.campaignId, c);
      if (!terms) throw new IntakeError("ยังไม่ได้ตั้งเงื่อนไขแคมเปญ");
      if (o.termsId !== terms.id) throw new IntakeError("เงื่อนไขแคมเปญมีการปรับปรุง กรุณาอ่านเงื่อนไขล่าสุดแล้วยืนยันอีกครั้ง", { $reload: "1" });
    }
    const mapped = extractMapped(form.schema, answers);
    const ins = (await c.query(
      `insert into form_submissions (org_id, form_id, version_id, answers, client_key, terms_id, consent_at, ip_hash, user_agent)
       values ($1,$2,$3,'{}',$4,$5,$6,$7,$8) returning id, ref_no`,
      [form.orgId, form.formId, form.versionId, o.clientKey, terms?.id ?? null, mapped.termsAccepted ? new Date() : null, o.meta.ipHash, o.meta.userAgent])).rows[0];
    const stored = await attachFiles(c, form, form.schema, answers, ins.id);
    await c.query(`update form_submissions set answers = $2 where id = $1`, [ins.id, JSON.stringify(stored)]);

    if (form.purpose !== "kol_application") {
      await audit(c, form.orgId, null, "form_submission.created", "form_submission", ins.id, null, { form: form.formId, version: form.versionNo }, "public");
      await notifyPermission(c, form.orgId, "forms.responses", null, `คำตอบใหม่: ${form.title}`, submissionRef(ins.ref_no), `/kol/forms/${form.formId}/responses`, `form:new:${ins.id}`);
      return { ref: submissionRef(ins.ref_no), statusUrl: null, successTitle: form.schema.settings.successTitle, successMessage: form.schema.settings.successMessage };
    }

    const m = extractMapped(form.schema, stored);
    if (!m.fullName) throw new IntakeError("กรุณากรอกชื่อ–นามสกุล");
    const photo = m.photo?.id ?? null;
    const app = (await c.query(
      `insert into kol_applicants (org_id, campaign_id, source_submission, full_name, creator_name, phone, line_id, email, photo_file_id, channels, categories,
                                   tennis_experience, bio, motivation, sample_links, terms_id, terms_accepted_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning id, ref_no`,
      [form.orgId, form.campaignId, ins.id, m.fullName, m.creatorName || m.fullName, m.phone ?? null, m.lineId ?? null, m.email ?? null, photo,
        m.channels, m.categories, m.tennis ?? null, m.bio ?? null, m.motivation ?? null, m.sampleLinks.slice(0, 30), terms!.id, m.termsAccepted ? new Date() : null])).rows[0];
    await c.query(`update form_submissions set applicant_id = $2 where id = $1`, [ins.id, app.id]);
    for (const [platform, s] of Object.entries(m.social)) {
      if (!s.url && s.followers === undefined) continue;
      await c.query(
        `insert into kol_social_accounts (org_id, applicant_id, platform, url, followers, source) values ($1,$2,$3,$4,$5,'application')`,
        [form.orgId, app.id, platform, s.url ?? null, s.followers ?? null]);
    }
    await logStatus(c, form.orgId, app.id, null, "submitted", null, "applicant", "ส่งใบสมัครผ่านฟอร์มออนไลน์");
    const token = newToken();
    await c.query(
      `insert into kol_access_tokens (org_id, applicant_id, purpose, token_hash, token_enc, expires_at) values ($1,$2,'status',$3,$4, now() + interval '365 days')`,
      [form.orgId, app.id, hashToken(token), encryptToken(token)]);
    await audit(c, form.orgId, null, "kol_applicant.submitted", "kol_applicant", app.id, null, { ref: applicantRef(app.ref_no), form_version: form.versionNo }, "public");
    await notifyPermission(c, form.orgId, "kol.review", null, "มีผู้สมัคร KOL ใหม่", `${applicantRef(app.ref_no)} ${m.creatorName || m.fullName}`, `/kol/applicants/${app.id}`, `kol:new:${app.id}`);
    return { ref: applicantRef(app.ref_no), statusUrl: `${o.baseUrl}/s/${token}`, successTitle: form.schema.settings.successTitle, successMessage: form.schema.settings.successMessage };
  });
}

// ---------------------------------------------------------------- access tokens
export type TokenApplicant = {
  tokenId: string; applicantId: string; orgId: string; status: string; refNo: number; fullName: string; creatorName: string; phone: string | null;
  lineId: string | null; email: string | null; campaignId: string; expiresAt: Date; erased: boolean;
};
export async function resolveToken(token: string, purpose: "status" | "registration"): Promise<TokenApplicant | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { rows } = await db().query(
    `select t.id as token_id, t.expires_at, a.id, a.org_id, a.status, a.ref_no, a.full_name, a.creator_name, a.phone, a.line_id, a.email, a.campaign_id, a.erased_at
       from kol_access_tokens t join kol_applicants a on a.id = t.applicant_id
      where t.token_hash = $1 and t.purpose = $2 and t.revoked_at is null and t.expires_at > now()`, [hashToken(token), purpose]);
  const r = rows[0];
  if (!r || r.erased_at) return null;
  return { tokenId: r.token_id, applicantId: r.id, orgId: r.org_id, status: r.status, refNo: r.ref_no, fullName: r.full_name, creatorName: r.creator_name,
    phone: r.phone, lineId: r.line_id, email: r.email, campaignId: r.campaign_id, expiresAt: r.expires_at, erased: !!r.erased_at };
}

export async function registrationFormFor(orgId: string): Promise<PublishedForm | null> {
  const { rows } = await db().query(`select id from forms where org_id = $1 and system_key = 'kol_registration'`, [orgId]);
  return rows[0] ? publishedById(rows[0].id) : null;
}

/** STEP 2: only an approved applicant with a valid, unexpired link. Never creates a new applicant or participant twice. */
export async function submitRegistration(o: { token: string; versionId: string; clientKey: string; raw: Record<string, unknown>; meta: Meta }): Promise<{ ref: string; title: string; message: string }> {
  const who = await resolveToken(o.token, "registration");
  if (!who) throw new IntakeError("ลิงก์นี้หมดอายุหรือถูกยกเลิกแล้ว กรุณาติดต่อทีมงานทาง LINE @wondercourts เพื่อขอลิงก์ใหม่");
  if (!TRANSITIONS.register.from.includes(who.status as never)) throw new IntakeError("ใบสมัครนี้ยังไม่ได้รับสิทธิ์กรอกข้อมูลขั้นที่ 2");
  const form = await registrationFormFor(who.orgId);
  if (!form || form.status !== "published") throw new IntakeError("แบบฟอร์มลงทะเบียนปิดอยู่ กรุณาติดต่อทีมงาน");
  if (form.versionId !== o.versionId) throw new IntakeError("แบบฟอร์มมีการปรับปรุงระหว่างที่กรอก ข้อมูลที่กรอกยังอยู่ กรุณาตรวจสอบอีกครั้งแล้วกดส่ง", { $reload: "1" });
  const { answers, errors } = validateAnswers(form.schema, o.raw);
  if (Object.keys(errors).length) throw new IntakeError("ยังมีช่องที่ต้องแก้ไข", errors);

  return withTransaction(async (c) => {
    const a = (await c.query(`select * from kol_applicants where id = $1 for update`, [who.applicantId])).rows[0];
    if (!a || !TRANSITIONS.register.from.includes(a.status)) throw new IntakeError("ใบสมัครนี้ยังไม่ได้รับสิทธิ์กรอกข้อมูลขั้นที่ 2");
    await lockClientKey(c, form.formId, o.clientKey);
    const dup = (await c.query(`select id from form_submissions where form_id = $1 and client_key = $2`, [form.formId, o.clientKey])).rows[0];
    if (dup) return { ref: applicantRef(a.ref_no), title: form.schema.settings.successTitle, message: form.schema.settings.successMessage };
    const terms = await currentTerms(a.campaign_id, c);
    if (!terms) throw new IntakeError("ยังไม่ได้ตั้งเงื่อนไขแคมเปญ");
    const sub = (await c.query(
      `insert into form_submissions (org_id, form_id, version_id, answers, client_key, applicant_id, terms_id, consent_at, ip_hash, user_agent)
       values ($1,$2,$3,'{}',$4,$5,$6,now(),$7,$8) returning id`,
      [who.orgId, form.formId, form.versionId, o.clientKey, a.id, terms.id, o.meta.ipHash, o.meta.userAgent])).rows[0];
    const stored = await attachFiles(c, form, form.schema, answers, sub.id);
    await c.query(`update form_submissions set answers = $2 where id = $1`, [sub.id, JSON.stringify(stored)]);
    const m = extractMapped(form.schema, stored);

    // The applicant may correct contact details and confirm their social accounts (same person, no duplicate).
    const before = { full_name: a.full_name, creator_name: a.creator_name, phone: a.phone, line_id: a.line_id, email: a.email };
    await c.query(
      `update kol_applicants set full_name = coalesce($2, full_name), creator_name = coalesce($3, creator_name), phone = coalesce($4, phone),
              line_id = coalesce($5, line_id), email = coalesce($6, email), status = 'registered',
              status_changed_at = case when status = 'registered' then status_changed_at else now() end, updated_at = now()
        where id = $1`,
      [a.id, m.fullName ?? null, m.creatorName ?? null, m.phone ?? null, m.lineId ?? null, m.email ?? null]);
    for (const [platform, s] of Object.entries(m.social)) {
      if (!s.url && s.followers === undefined) continue;
      await c.query(
        `insert into kol_social_accounts (org_id, applicant_id, platform, url, followers, source) values ($1,$2,$3,$4,$5,'registration')
         on conflict (applicant_id, platform) do update set url = coalesce(excluded.url, kol_social_accounts.url),
                followers = coalesce(excluded.followers, kol_social_accounts.followers), source = 'registration', updated_at = now()`,
        [who.orgId, a.id, platform, s.url ?? null, s.followers ?? null]);
    }
    const reg = (await c.query(
      `insert into kol_registrations (org_id, applicant_id, submission_id, visit_date, visit_time, coach_required, membership_name, notes, terms_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (applicant_id) do update set submission_id = excluded.submission_id, visit_date = excluded.visit_date, visit_time = excluded.visit_time,
              coach_required = excluded.coach_required, membership_name = excluded.membership_name, notes = excluded.notes, updated_at = now()
       returning (xmax = 0) as inserted`,
      [who.orgId, a.id, sub.id, m.visitDate ?? null, m.visitTime ?? null, m.coach ?? null, m.membershipName ?? null, m.notes ?? null, terms.id])).rows[0];

    // Campaign participant record: created once per applicant + campaign with the deliverables and credit of the terms in force.
    const approvedAt = (await c.query(`select max(d.decided_at) as at from kol_approval_decisions d join kol_approval_requests r on r.id = d.approval_request_id
                                        where r.applicant_id = $1 and d.decision = 'approved'`, [a.id])).rows[0].at ?? new Date();
    const part = (await c.query(
      `insert into kol_participants (org_id, applicant_id, campaign_id, terms_id, approved_at, visit_date, visit_time, visit_status, coach_required)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (applicant_id, campaign_id) do update set visit_date = excluded.visit_date, visit_time = excluded.visit_time,
              coach_required = excluded.coach_required,
              visit_status = case when kol_participants.visit_status in ('visited') then kol_participants.visit_status else excluded.visit_status end,
              updated_at = now()
       returning id, (xmax = 0) as inserted`,
      [who.orgId, a.id, a.campaign_id, terms.id, approvedAt, m.visitDate ?? null, m.visitTime ?? null, m.visitDate ? "scheduled" : "not_scheduled", m.coach ?? null])).rows[0];
    if (part.inserted) {
      for (const [i, d] of terms.deliverables.entries()) {
        await c.query(`insert into kol_deliverables (org_id, participant_id, key, label, sort_order) values ($1,$2,$3,$4,$5) on conflict do nothing`,
          [who.orgId, part.id, d.key, d.label, i]);
      }
      await c.query(
        `insert into kol_court_credits (org_id, participant_id, kind, hours, value_satang, occurred_on, note) values ($1,$2,'entitlement',$3,$4,(now() at time zone 'Asia/Bangkok')::date,$5)
         on conflict do nothing`,
        [who.orgId, part.id, terms.creditHours, terms.creditValueSatang, `สิทธิ์ตามเงื่อนไขแคมเปญ v${terms.versionNo}`]);
    }
    await logStatus(c, who.orgId, a.id, a.status, "registered", null, "applicant", reg.inserted ? "กรอกข้อมูล STEP 2 ผ่านลิงก์เฉพาะ" : "แก้ไขข้อมูล STEP 2");
    await c.query(`update kol_access_tokens set last_used_at = now() where id = $1`, [who.tokenId]);
    await audit(c, who.orgId, null, reg.inserted ? "kol_registration.submitted" : "kol_registration.updated", "kol_applicant", a.id, before,
      { submission: sub.id, visit_date: m.visitDate, visit_time: m.visitTime, coach: m.coach }, "public");
    await notifyPermission(c, who.orgId, "kol.review", null, reg.inserted ? "KOL กรอก STEP 2 เสร็จแล้ว" : "KOL แก้ไขข้อมูล STEP 2",
      `${applicantRef(a.ref_no)} ${m.creatorName || a.creator_name}${m.visitDate ? ` · นัด ${m.visitDate}` : ""}`, `/kol/campaign/${part.id}`, `kol:reg:${sub.id}`);
    return { ref: applicantRef(a.ref_no), title: form.schema.settings.successTitle, message: form.schema.settings.successMessage };
  });
}
