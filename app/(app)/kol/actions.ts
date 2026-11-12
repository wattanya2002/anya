"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { PoolClient } from "pg";
import { getCurrentUser, can, type CurrentUser } from "@/lib/auth";
import { db, withTransaction } from "@/lib/db";
import type { FormState } from "@/app/actions";
import {
  normalizeSchema, publishIssues, checkField, extractMapped, allFields, validateAnswers, type FormSchema, type SchemaIssue, type Purpose,
} from "@/lib/forms-core";
import { publishVersion } from "@/lib/forms-server";
import { applicantRef, canTransition, infoRequestMessage, registrationMessage, isPromoCode, DELIVERABLE_STATUSES, VISIT_STATUSES, type ApplicantStatus, type TransitionKey } from "@/lib/kol-core";
import { audit, currentTerms, logStatus, notifyPermission, notifyUser } from "@/lib/kol";
import { decryptToken, encryptToken, hashToken, newToken } from "@/lib/kol-security";

// ---------------------------------------------------------------- helpers
async function actor(permission: string): Promise<CurrentUser | string> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!can(user, permission)) return "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้";
  return user;
}
const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const str = (fd: FormData, k: string, max = 2000) => String(fd.get(k) ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const fieldsOf = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
class UserError extends Error {}
function handle(err: unknown, fields?: Record<string, string>): FormState {
  if (err instanceof UserError) return { error: err.message, fields };
  const code = (err as { code?: string }).code;
  if (code === "23505") return { error: "รายการนี้ถูกบันทึกไปแล้ว (อาจกดซ้ำหรือทำจากอีกอุปกรณ์) กรุณารีเฟรช", fields };
  if (code === "23514") return { error: "ข้อมูลบางช่องไม่อยู่ในรูปแบบที่กำหนด", fields };
  console.error("kol action failed", err);
  return { error: "บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง", fields };
}
async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Locks the applicant row, checks the transition is allowed from its current status, applies it and logs it. */
async function transition(c: PoolClient, u: CurrentUser, applicantId: string, key: TransitionKey, note: string | null, extra: { rejectedStage?: "screening" | "ceo" } = {}) {
  const a = (await c.query(`select id, status, ref_no, creator_name, erased_at from kol_applicants where id = $1 and org_id = $2 for update`, [applicantId, u.orgId])).rows[0];
  if (!a || a.erased_at) throw new UserError("ไม่พบผู้สมัครนี้");
  if (!canTransition(key, a.status)) throw new UserError(`ทำรายการนี้ไม่ได้ เพราะสถานะปัจจุบันเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า`);
  const to = ({ shortlist: "shortlisted", request_info: "info_requested", reject_screening: "rejected", send_to_ceo: "pending_ceo", ceo_approve: "approved",
    ceo_reject: "rejected", ceo_request_info: "ceo_info_requested", register: "registered" } as Record<TransitionKey, ApplicantStatus>)[key];
  await c.query(`update kol_applicants set status = $2, rejected_stage = $3, status_changed_at = now(), updated_at = now() where id = $1`,
    [applicantId, to, to === "rejected" ? extra.rejectedStage ?? "screening" : null]);
  await logStatus(c, u.orgId, applicantId, a.status, to, u.id, "user", note);
  await audit(c, u.orgId, u.id, `kol_applicant.${key}`, "kol_applicant", applicantId, { status: a.status }, { status: to, note });
  return { before: a.status as ApplicantStatus, after: to, refNo: a.ref_no as number, name: a.creator_name as string };
}

const revalidateKol = () => revalidatePath("/kol", "layout");

// ================================================================ Form Builder
export type DraftResult = { ok?: true; rev?: number; savedAt?: string; error?: string; conflict?: boolean; issues?: SchemaIssue[]; versionNo?: number };

/** Saves the editor's working copy. `rev` detects edits from another device (no silent overwrite). */
export async function saveFormDraft(formId: string, rev: number, title: string, draft: unknown): Promise<DraftResult> {
  const u = await actor("forms.manage");
  if (typeof u === "string") return { error: u };
  if (!isUuid(formId)) return { error: "ไม่พบฟอร์ม" };
  let schema: FormSchema;
  try { schema = normalizeSchema(draft); } catch (e) { return { error: (e as Error).message }; }
  const t = String(title ?? "").trim().slice(0, 160);
  if (!t) return { error: "ตั้งชื่อฟอร์มก่อนบันทึก" };
  try {
    return await withTransaction(async (c) => {
      const f = (await c.query(`select draft_rev, title from forms where id = $1 and org_id = $2 for update`, [formId, u.orgId])).rows[0];
      if (!f) throw new UserError("ไม่พบฟอร์ม");
      if (f.draft_rev !== rev) return { error: "ฟอร์มนี้ถูกแก้ไขจากอีกอุปกรณ์ กรุณาโหลดใหม่ก่อนบันทึก (ระบบยังไม่ได้บันทึกการแก้ไขของคุณ)", conflict: true };
      const r = (await c.query(
        `update forms set draft = $2, title = $3, draft_rev = draft_rev + 1, draft_dirty = true, updated_at = now() where id = $1 returning draft_rev, updated_at`,
        [formId, JSON.stringify(schema), t])).rows[0];
      await audit(c, u.orgId, u.id, "form.draft_saved", "form", formId, null, { rev: r.draft_rev, title: t });
      return { ok: true as const, rev: r.draft_rev as number, savedAt: (r.updated_at as Date).toISOString() };
    });
  } catch (err) { return { error: handle(err).error }; }
}

/** Publishes the saved draft as a new version. Old answers keep pointing at their own version. */
export async function publishForm(formId: string, rev: number): Promise<DraftResult> {
  const u = await actor("forms.manage");
  if (typeof u === "string") return { error: u };
  if (!isUuid(formId)) return { error: "ไม่พบฟอร์ม" };
  try {
    const r = await withTransaction(async (c) => {
      const f = (await c.query(`select * from forms where id = $1 and org_id = $2 for update`, [formId, u.orgId])).rows[0];
      if (!f) throw new UserError("ไม่พบฟอร์ม");
      if (f.draft_rev !== rev) return { error: "ฟอร์มนี้ถูกแก้ไขจากอีกอุปกรณ์ กรุณาโหลดใหม่", conflict: true } as DraftResult;
      const schema = normalizeSchema(f.draft);
      const issues = publishIssues(schema, f.purpose as Purpose);
      if (issues.length) return { error: "ยังเผยแพร่ไม่ได้ กรุณาแก้ตามรายการ", issues } as DraftResult;
      const terms = f.campaign_id ? await currentTerms(f.campaign_id, c) : null;
      const v = await publishVersion(c, { orgId: u.orgId, formId, schema, userId: u.id, termsId: terms?.id ?? null });
      await audit(c, u.orgId, u.id, "form.published", "form", formId, null, { version: v.versionNo });
      return { ok: true as const, versionNo: v.versionNo, rev } as DraftResult;
    });
    revalidateKol();
    revalidatePath("/f", "layout");
    return r;
  } catch (err) { return { error: handle(err).error }; }
}

/** Throws away unpublished edits: the draft becomes the published version again. */
export async function discardDraft(formId: string): Promise<DraftResult> {
  const u = await actor("forms.manage");
  if (typeof u === "string") return { error: u };
  if (!isUuid(formId)) return { error: "ไม่พบฟอร์ม" };
  try {
    const r = await withTransaction(async (c) => {
      const f = (await c.query(`select f.id, v.schema from forms f join form_versions v on v.id = f.current_version_id where f.id = $1 and f.org_id = $2 for update of f`, [formId, u.orgId])).rows[0];
      if (!f) throw new UserError("ฟอร์มนี้ยังไม่เคยเผยแพร่");
      const row = (await c.query(`update forms set draft = $2, draft_rev = draft_rev + 1, draft_dirty = false, updated_at = now() where id = $1 returning draft_rev`, [formId, JSON.stringify(f.schema)])).rows[0];
      await audit(c, u.orgId, u.id, "form.draft_discarded", "form", formId, null, null);
      return { ok: true as const, rev: row.draft_rev as number };
    });
    revalidateKol();
    return r;
  } catch (err) { return { error: handle(err).error }; }
}

export async function setFormStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("forms.manage");
  if (typeof u === "string") return { error: u };
  const id = str(fd, "form_id");
  const to = str(fd, "status");
  if (!isUuid(id) || (to !== "closed" && to !== "published")) return { error: "คำสั่งไม่ถูกต้อง" };
  try {
    await withTransaction(async (c) => {
      const f = (await c.query(`select status, current_version_id from forms where id = $1 and org_id = $2 for update`, [id, u.orgId])).rows[0];
      if (!f) throw new UserError("ไม่พบฟอร์ม");
      if (to === "published" && !f.current_version_id) throw new UserError("ฟอร์มนี้ยังไม่เคยเผยแพร่ กรุณากดเผยแพร่จากหน้าแก้ไข");
      await c.query(`update forms set status = $2, closed_at = case when $2 = 'closed' then now() else null end, updated_at = now() where id = $1`, [id, to]);
      await audit(c, u.orgId, u.id, to === "closed" ? "form.closed" : "form.reopened", "form", id, { status: f.status }, { status: to });
    });
  } catch (err) { return handle(err); }
  revalidateKol();
  return { ok: to === "closed" ? "ปิดรับคำตอบแล้ว" : "เปิดรับคำตอบอีกครั้งแล้ว" };
}

const slugify = (title: string) => {
  const base = title.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
  return `${base.length >= 3 ? base : "form"}-${Math.random().toString(36).slice(2, 8)}`;
};

export async function createForm(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("forms.manage");
  if (typeof u === "string") return { error: u };
  const title = str(fd, "title", 160);
  if (!title) return { error: "ตั้งชื่อฟอร์ม", fields: fieldsOf(fd) };
  const empty: FormSchema = normalizeSchema({ sections: [{ key: "s_main", title: "คำถาม", fields: [] }], settings: { intro: "", submitLabel: "ส่งคำตอบ", startLabel: "เริ่มทำแบบฟอร์ม" } });
  let id = "";
  try {
    id = await withTransaction(async (c) => {
      const r = (await c.query(`insert into forms (org_id, purpose, title, slug, draft, created_by) values ($1,'general',$2,$3,$4,$5) returning id`,
        [u.orgId, title, slugify(title), JSON.stringify(empty), u.id])).rows[0];
      await audit(c, u.orgId, u.id, "form.created", "form", r.id, null, { title, purpose: "general" });
      return r.id as string;
    });
  } catch (err) { return handle(err, fieldsOf(fd)); }
  revalidateKol();
  redirect(`/kol/forms/${id}/edit`);
}

/** Copies the current draft into a new general-purpose form (system workflows are never duplicated). */
export async function duplicateForm(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("forms.manage");
  if (typeof u === "string") return { error: u };
  const src = str(fd, "form_id");
  if (!isUuid(src)) return { error: "ไม่พบฟอร์ม" };
  let id = "";
  try {
    id = await withTransaction(async (c) => {
      const f = (await c.query(`select title, draft from forms where id = $1 and org_id = $2`, [src, u.orgId])).rows[0];
      if (!f) throw new UserError("ไม่พบฟอร์ม");
      const title = `${f.title} (สำเนา)`.slice(0, 160);
      const schema = normalizeSchema(f.draft);
      const r =(await c.query(`insert into forms (org_id, purpose, title, slug, draft, created_by) values ($1,'general',$2,$3,$4,$5) returning id`,
        [u.orgId, title, slugify(f.title), JSON.stringify(schema), u.id])).rows[0];
      await audit(c, u.orgId, u.id, "form.duplicated", "form", r.id, { from: src }, { title });
      return r.id as string;
    });
  } catch (err) { return handle(err); }
  revalidateKol();
  redirect(`/kol/forms/${id}/edit`);
}

// ================================================================ responses
/** Corrects one answer. The old value is kept in form_submission_edits; applicant data follows its mapped answers. */
export async function editAnswer(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("forms.edit_responses");
  const fields = fieldsOf(fd);
  if (typeof u === "string") return { error: u, fields };
  const subId = str(fd, "submission_id");
  const key = str(fd, "field_key", 60);
  const reason = str(fd, "reason", 500) || null;
  if (!isUuid(subId)) return { error: "ไม่พบคำตอบ", fields };
  // Multiple-choice edits arrive as one "multi" entry per ticked option.
  const raw: unknown = str(fd, "json") === "1" ? fd.getAll("multi").map(String) : str(fd, "value", 4000);
  try {
    await withTransaction(async (c) => {
      const s = (await c.query(
        `select s.id, s.answers, s.form_id, s.applicant_id, v.schema, a.source_submission
           from form_submissions s join form_versions v on v.id = s.version_id left join kol_applicants a on a.id = s.applicant_id
          where s.id = $1 and s.org_id = $2 for update of s`, [subId, u.orgId])).rows[0];
      if (!s) throw new UserError("ไม่พบคำตอบ");
      const schema = normalizeSchema(s.schema);
      const field = allFields(schema).find((f) => f.key === key);
      if (!field) throw new UserError("ไม่พบคำถามนี้ในเวอร์ชันของคำตอบ");
      if (field.type === "file" || field.type === "image") throw new UserError("ไฟล์แนบแก้ไขจากหน้านี้ไม่ได้");
      const [val, err] = checkField({ ...field, required: false }, raw);
      if (err) throw new UserError(err);
      const before = s.answers[key] ?? null;
      const answers = { ...s.answers };
      if (val === null || val === "") delete answers[key]; else answers[key] = val;
      const { errors } = validateAnswers(schema, answers);
      await c.query(`update form_submissions set answers = $2, incomplete = $3, updated_at = now(), updated_by = $4 where id = $1`,
        [subId, JSON.stringify(answers), Object.keys(errors).length > 0, u.id]);
      await c.query(`insert into form_submission_edits (org_id, submission_id, field_key, before, after, reason, edited_by) values ($1,$2,$3,$4,$5,$6,$7)`,
        [u.orgId, subId, key, JSON.stringify(before), JSON.stringify(answers[key] ?? null), reason, u.id]);
      if (s.applicant_id && s.source_submission === subId && field.mapsTo) {
        const m = extractMapped(schema, answers);
        await c.query(
          `update kol_applicants set full_name = coalesce($2, full_name), creator_name = coalesce($3, creator_name), phone = $4, line_id = $5,
                  categories = $6, tennis_experience = $7, bio = $8, motivation = $9, updated_at = now() where id = $1`,
          [s.applicant_id, m.fullName ?? null, m.creatorName ?? null, m.phone ?? null, m.lineId ?? null, m.categories, m.tennis ?? null, m.bio ?? null, m.motivation ?? null]);
        for (const [platform, acc] of Object.entries(m.social)) {
          await c.query(
            `insert into kol_social_accounts (org_id, applicant_id, platform, url, followers, source) values ($1,$2,$3,$4,$5,'team')
             on conflict (applicant_id, platform) do update set url = excluded.url, followers = excluded.followers, source = 'team', updated_at = now()`,
            [u.orgId, s.applicant_id, platform, acc.url ?? null, acc.followers ?? null]);
        }
      }
      await audit(c, u.orgId, u.id, "form_submission.answer_edited", "form_submission", subId, { [key]: before }, { [key]: answers[key] ?? null, reason });
    });
  } catch (err) { return handle(err, fields); }
  revalidateKol();
  return { ok: "แก้ไขคำตอบแล้ว (เก็บประวัติไว้)" };
}

export async function saveResponseInternal(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("forms.responses");
  const fields = fieldsOf(fd);
  if (typeof u === "string") return { error: u, fields };
  const subId = str(fd, "submission_id");
  if (!isUuid(subId)) return { error: "ไม่พบคำตอบ", fields };
  const note = str(fd, "internal_note", 4000) || null;
  const incomplete = fd.get("incomplete") === "on";
  try {
    await withTransaction(async (c) => {
      const s = (await c.query(`select internal_note, incomplete from form_submissions where id = $1 and org_id = $2 for update`, [subId, u.orgId])).rows[0];
      if (!s) throw new UserError("ไม่พบคำตอบ");
      await c.query(`update form_submissions set internal_note = $2, incomplete = $3, updated_at = now(), updated_by = $4 where id = $1`, [subId, note, incomplete, u.id]);
      await audit(c, u.orgId, u.id, "form_submission.internal_updated", "form_submission", subId, s, { internal_note: note, incomplete });
    });
  } catch (err) { return handle(err, fields); }
  revalidateKol();
  return { ok: "บันทึกข้อมูลภายในแล้ว" };
}

// ================================================================ marketing review
export async function addReviewNote(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  if (typeof u === "string") return { error: u };
  const id = str(fd, "applicant_id");
  const body = str(fd, "body", 4000);
  const key = str(fd, "client_key", 64) || null;
  if (!isUuid(id)) return { error: "ไม่พบผู้สมัคร" };
  if (!body) return { error: "พิมพ์หมายเหตุก่อนบันทึก" };
  try {
    await withTransaction(async (c) => {
      const a = (await c.query(`select id from kol_applicants where id = $1 and org_id = $2`, [id, u.orgId])).rows[0];
      if (!a) throw new UserError("ไม่พบผู้สมัคร");
      const r = await c.query(`insert into kol_reviews (org_id, applicant_id, kind, body, reviewer_id, client_key) values ($1,$2,'note',$3,$4,$5)
                               on conflict (applicant_id, client_key) do nothing returning id`, [u.orgId, id, body, u.id, key]);
      if (r.rows[0]) await audit(c, u.orgId, u.id, "kol_applicant.note_added", "kol_applicant", id, null, { body });
    });
  } catch (err) { return handle(err, { body }); }
  revalidateKol();
  return { ok: "บันทึกหมายเหตุแล้ว", nonce: String(Date.now()) };
}

export async function shortlistApplicant(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  if (typeof u === "string") return { error: u };
  const id = str(fd, "applicant_id");
  const note = str(fd, "note", 2000) || null;
  if (!isUuid(id)) return { error: "ไม่พบผู้สมัคร" };
  try {
    await withTransaction(async (c) => {
      await transition(c, u, id, "shortlist", note);
      await c.query(`insert into kol_reviews (org_id, applicant_id, kind, body, reviewer_id) values ($1,$2,'shortlist',$3,$4)`, [u.orgId, id, note, u.id]);
    });
  } catch (err) { return handle(err); }
  revalidateKol();
  return { ok: "ย้ายเข้ารายชื่อผ่านการคัดกรองแล้ว" };
}

export async function requestInfoFromApplicant(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  const fields = fieldsOf(fd);
  if (typeof u === "string") return { error: u, fields };
  const id = str(fd, "applicant_id");
  const reason = str(fd, "reason", 2000);
  if (!isUuid(id)) return { error: "ไม่พบผู้สมัคร", fields };
  if (!reason) return { error: "ระบุข้อมูลที่ต้องการให้ผู้สมัครส่งเพิ่ม", fields };
  let msg = "";
  try {
    msg = await withTransaction(async (c) => {
      const t = await transition(c, u, id, "request_info", reason);
      await c.query(`insert into kol_reviews (org_id, applicant_id, kind, body, reviewer_id) values ($1,$2,'request_info',$3,$4)`, [u.orgId, id, reason, u.id]);
      return infoRequestMessage({ name: t.name, ref: applicantRef(t.refNo), reason });
    });
  } catch (err) { return handle(err, fields); }
  revalidateKol();
  return { ok: "บันทึกคำขอข้อมูลเพิ่มแล้ว — ระบบยังไม่ส่งข้อความเอง กรุณาคัดลอกข้อความไปส่งทาง LINE", warn: msg };
}

export async function rejectAtScreening(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  const fields = fieldsOf(fd);
  if (typeof u === "string") return { error: u, fields };
  const id = str(fd, "applicant_id");
  const reason = str(fd, "reason", 2000);
  if (!isUuid(id)) return { error: "ไม่พบผู้สมัคร", fields };
  if (!reason) return { error: "ระบุเหตุผลที่ไม่ผ่านการคัดกรอง", fields };
  if (fd.get("confirm") !== "yes") return { error: "กรุณายืนยันการไม่ผ่านการคัดกรอง", fields };
  try {
    await withTransaction(async (c) => {
      await transition(c, u, id, "reject_screening", reason, { rejectedStage: "screening" });
      await c.query(`insert into kol_reviews (org_id, applicant_id, kind, body, reviewer_id) values ($1,$2,'reject',$3,$4)`, [u.orgId, id, reason, u.id]);
    });
  } catch (err) { return handle(err, fields); }
  revalidateKol();
  return { ok: "บันทึกว่าไม่ผ่านการคัดกรองแล้ว" };
}

/** Creates a real approval request; the card appears in the CEO inbox from the same table. */
export async function sendToCeo(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  const fields = fieldsOf(fd);
  if (typeof u === "string") return { error: u, fields };
  const id = str(fd, "applicant_id");
  const pitch = str(fd, "short_pitch", 200);
  const opinion = str(fd, "opinion", 2000);
  const campaignId = str(fd, "campaign_id");
  if (!isUuid(id)) return { error: "ไม่พบผู้สมัคร", fields };
  if (!pitch) return { error: "กรอกข้อเสนอสั้น ๆ ที่จะแสดงบนการ์ด CEO", fields: { ...fields, $field: "short_pitch" } };
  if (!opinion) return { error: "กรอกความเห็นของ Marketing", fields: { ...fields, $field: "opinion" } };
  if (!isUuid(campaignId)) return { error: "เลือกแคมเปญที่ต้องการให้เข้าร่วม", fields };
  try {
    await withTransaction(async (c) => {
      const camp = (await c.query(`select 1 from kol_campaigns where campaign_id = $1 and org_id = $2`, [campaignId, u.orgId])).rows[0];
      if (!camp) throw new UserError("ไม่พบแคมเปญนี้");
      const t = await transition(c, u, id, "send_to_ceo", pitch);
      const round = (await c.query(`select coalesce(max(round_no), 0) + 1 as n from kol_approval_requests where applicant_id = $1`, [id])).rows[0].n;
      const r = (await c.query(
        `insert into kol_approval_requests (org_id, applicant_id, round_no, campaign_id, short_pitch, opinion, reason, highlights, cautions, submitted_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [u.orgId, id, round, campaignId, pitch, opinion, str(fd, "reason") || null, str(fd, "highlights") || null, str(fd, "cautions") || null, u.id])).rows[0];
      await c.query(`update kol_applicants set campaign_id = $2 where id = $1`, [id, campaignId]);
      await audit(c, u.orgId, u.id, "kol_approval.requested", "kol_approval_request", r.id, null, { applicant: id, round, pitch });
      await notifyPermission(c, u.orgId, "kol.decide", u.id, "การ์ด KOL รอ CEO พิจารณา", `${applicantRef(t.refNo)} ${t.name} — ${pitch}`, `/kol/ceo/r/${r.id}`, `kol:ceo:${r.id}`);
    });
  } catch (err) { return handle(err, fields); }
  revalidateKol();
  return { ok: "ส่งการ์ดให้ CEO แล้ว" };
}

// ================================================================ CEO decision
export type DecisionResult = FormState & { decided?: { status: string; byName: string; at: string; link?: string; message?: string } };

async function issueToken(c: PoolClient, u: CurrentUser, applicantId: string, purpose: "status" | "registration", days: number) {
  await c.query(`update kol_access_tokens set revoked_at = now() where applicant_id = $1 and purpose = $2 and revoked_at is null`, [applicantId, purpose]);
  const token = newToken();
  const row = (await c.query(
    `insert into kol_access_tokens (org_id, applicant_id, purpose, token_hash, token_enc, expires_at, created_by)
     values ($1,$2,$3,$4,$5, now() + make_interval(days => $6), $7) returning id, expires_at`,
    [u.orgId, applicantId, purpose, hashToken(token), encryptToken(token), days, u.id])).rows[0];
  return { token, expiresAt: row.expires_at as Date, id: row.id as string };
}

export async function decideApproval(_prev: DecisionResult, fd: FormData): Promise<DecisionResult> {
  const u = await actor("kol.decide");
  if (typeof u === "string") return { error: u };
  const reqId = str(fd, "request_id");
  const decision = str(fd, "decision");
  const note = str(fd, "note", 2000) || null;
  if (!isUuid(reqId) || !["approved", "rejected", "info_requested"].includes(decision)) return { error: "คำสั่งไม่ถูกต้อง" };
  if (decision !== "approved" && !note) return { error: decision === "rejected" ? "ระบุเหตุผลที่ไม่อนุมัติ" : "ระบุข้อมูลที่ต้องการเพิ่ม", fields: { note: "" } };
  if (decision === "rejected" && fd.get("confirm") !== "yes") return { error: "กรุณายืนยันการไม่อนุมัติ" };
  const base = await baseUrl();
  try {
    const out = await withTransaction(async (c) => {
      const r = (await c.query(`select * from kol_approval_requests where id = $1 and org_id = $2 for update`, [reqId, u.orgId])).rows[0];
      if (!r) throw new UserError("ไม่พบการ์ดนี้");
      if (r.status !== "pending") {
        const d = (await c.query(`select d.decision, u.display_name, d.decided_at from kol_approval_decisions d join users u on u.id = d.decided_by where d.approval_request_id = $1`, [reqId])).rows[0];
        throw new UserError(`การ์ดนี้ตัดสินใจไปแล้ว${d ? ` (${d.decision === "approved" ? "อนุมัติ" : d.decision === "rejected" ? "ไม่อนุมัติ" : "ขอข้อมูลเพิ่ม"} โดย ${d.display_name})` : ""} — ไม่มีการบันทึกซ้ำ`);
      }
      const ins = (await c.query(
        `insert into kol_approval_decisions (org_id, approval_request_id, decision, note, decided_by) values ($1,$2,$3,$4,$5) returning decided_at`,
        [u.orgId, reqId, decision, note, u.id])).rows[0];
      await c.query(`update kol_approval_requests set status = $2, decided_at = $3 where id = $1`, [reqId, decision, ins.decided_at]);
      const key: TransitionKey = decision === "approved" ? "ceo_approve" : decision === "rejected" ? "ceo_reject" : "ceo_request_info";
      const t = await transition(c, u, r.applicant_id, key, note, { rejectedStage: "ceo" });
      await audit(c, u.orgId, u.id, `kol_approval.${decision}`, "kol_approval_request", reqId, { status: "pending" }, { status: decision, note });
      const label = decision === "approved" ? "CEO อนุมัติ KOL" : decision === "rejected" ? "CEO ไม่อนุมัติ KOL" : "CEO ขอข้อมูลเพิ่ม";
      const body = `${applicantRef(t.refNo)} ${t.name}${note ? ` — ${note}` : ""}`;
      await notifyUser(c, u.orgId, r.submitted_by, label, body, `/kol/applicants/${r.applicant_id}`, `kol:dec:${reqId}`);
      await notifyPermission(c, u.orgId, "kol.review", u.id, label, body, `/kol/applicants/${r.applicant_id}`, `kol:dec:${reqId}`);
      let link: string | undefined, message: string | undefined;
      if (decision === "approved") {
        const tk = await issueToken(c, u, r.applicant_id, "registration", 14);
        link = `${base}/r/${tk.token}`;
        message = registrationMessage({ name: t.name, url: link, expiresAt: tk.expiresAt });
        await audit(c, u.orgId, u.id, "kol_link.issued", "kol_applicant", r.applicant_id, null, { purpose: "registration", days: 14, auto: true });
      }
      return { status: decision, byName: u.displayName, at: (ins.decided_at as Date).toISOString(), link, message };
    });
    revalidateKol();
    return { ok: out.status === "approved" ? "อนุมัติแล้ว" : out.status === "rejected" ? "บันทึกไม่อนุมัติแล้ว" : "ส่งคำขอข้อมูลเพิ่มให้ Marketing แล้ว", decided: out };
  } catch (err) { return handle(err); }
}

export async function addKolComment(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.view");
  if (typeof u === "string") return { error: u };
  const id = str(fd, "applicant_id");
  const reqId = str(fd, "request_id");
  const body = str(fd, "body", 2000);
  const key = str(fd, "client_key", 64) || null;
  if (!isUuid(id)) return { error: "ไม่พบผู้สมัคร" };
  if (!body) return { error: "พิมพ์ความคิดเห็นก่อนส่ง (ไม่เกิน 2,000 ตัวอักษร)" };
  try {
    await withTransaction(async (c) => {
      const a = (await c.query(`select ref_no, creator_name from kol_applicants where id = $1 and org_id = $2`, [id, u.orgId])).rows[0];
      if (!a) throw new UserError("ไม่พบผู้สมัคร");
      const ins = await c.query(
        `insert into kol_comments (org_id, applicant_id, approval_request_id, author_id, body, client_key) values ($1,$2,$3,$4,$5,$6)
         on conflict (applicant_id, client_key) do nothing returning id`, [u.orgId, id, isUuid(reqId) ? reqId : null, u.id, body, key]);
      if (!ins.rows[0]) return;
      await audit(c, u.orgId, u.id, "kol_comment.added", "kol_applicant", id, null, { body });
      const perm = can(u, "kol.decide") && !can(u, "kol.review") ? "kol.review" : "kol.decide";
      await notifyPermission(c, u.orgId, perm, u.id, `ความคิดเห็นใหม่: ${a.creator_name}`, body.slice(0, 120), perm === "kol.review" ? `/kol/applicants/${id}` : `/kol/ceo?tab=all`, `kol:cmt:${ins.rows[0].id}`);
    });
  } catch (err) { return handle(err); }
  revalidateKol();
  return { ok: "ส่งความคิดเห็นแล้ว" };
}

// ================================================================ applicant links
export async function issueApplicantLink(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  if (typeof u === "string") return { error: u };
  const id = str(fd, "applicant_id");
  const purpose = str(fd, "purpose") === "status" ? "status" : "registration";
  const days = Math.min(60, Math.max(1, Number(str(fd, "days")) || 14));
  if (!isUuid(id)) return { error: "ไม่พบผู้สมัคร" };
  try {
    const out = await withTransaction(async (c) => {
      const a = (await c.query(`select status, creator_name from kol_applicants where id = $1 and org_id = $2 for update`, [id, u.orgId])).rows[0];
      if (!a) throw new UserError("ไม่พบผู้สมัคร");
      if (purpose === "registration" && !["approved", "registered"].includes(a.status)) throw new UserError("ออกลิงก์ STEP 2 ได้หลัง CEO อนุมัติแล้วเท่านั้น");
      const tk = await issueToken(c, u, id, purpose, purpose === "status" ? 365 : days);
      await audit(c, u.orgId, u.id, "kol_link.issued", "kol_applicant", id, null, { purpose, days });
      const url = `${await baseUrl()}/${purpose === "status" ? "s" : "r"}/${tk.token}`;
      return purpose === "registration" ? registrationMessage({ name: a.creator_name, url, expiresAt: tk.expiresAt }) : url;
    });
    revalidateKol();
    return { ok: "ออกลิงก์ใหม่แล้ว ลิงก์เดิมใช้ไม่ได้แล้ว", warn: out };
  } catch (err) { return handle(err); }
}

export async function revokeApplicantLink(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  if (typeof u === "string") return { error: u };
  const id = str(fd, "token_id");
  if (!isUuid(id)) return { error: "ไม่พบลิงก์" };
  try {
    await withTransaction(async (c) => {
      const t = (await c.query(`update kol_access_tokens set revoked_at = now() where id = $1 and org_id = $2 and revoked_at is null returning applicant_id, purpose`, [id, u.orgId])).rows[0];
      if (!t) throw new UserError("ลิงก์นี้ถูกยกเลิกไปแล้ว");
      await audit(c, u.orgId, u.id, "kol_link.revoked", "kol_applicant", t.applicant_id, null, { purpose: t.purpose });
    });
  } catch (err) { return handle(err); }
  revalidateKol();
  return { ok: "ยกเลิกลิงก์แล้ว" };
}

/** Plain-text link for "copy" buttons: decrypted on the server for team members only, never stored in the page HTML. */
export async function revealLink(tokenId: string): Promise<{ url?: string; error?: string }> {
  const u = await actor("kol.review");
  if (typeof u === "string") return { error: u };
  if (!isUuid(tokenId)) return { error: "ไม่พบลิงก์" };
  const r = (await db().query(`select purpose, token_enc, revoked_at, expires_at from kol_access_tokens where id = $1 and org_id = $2`, [tokenId, u.orgId])).rows[0];
  if (!r || r.revoked_at || r.expires_at < new Date()) return { error: "ลิงก์นี้หมดอายุหรือถูกยกเลิกแล้ว กรุณาออกลิงก์ใหม่" };
  const token = decryptToken(r.token_enc);
  if (!token) return { error: "เปิดลิงก์เดิมไม่ได้ กรุณาออกลิงก์ใหม่" };
  return { url: `${await baseUrl()}/${r.purpose === "status" ? "s" : "r"}/${token}` };
}

/** Privacy: erase an applicant's personal data (keeps anonymous status history for counts and audit). */
export async function eraseApplicant(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("privacy.manage");
  if (typeof u === "string") return { error: u };
  const id = str(fd, "applicant_id");
  if (!isUuid(id)) return { error: "ไม่พบผู้สมัคร" };
  if (str(fd, "confirm") !== "ลบข้อมูล") return { error: "พิมพ์คำว่า ลบข้อมูล เพื่อยืนยัน" };
  try {
    await withTransaction(async (c) => {
      const a = (await c.query(`select id, ref_no, erased_at from kol_applicants where id = $1 and org_id = $2 for update`, [id, u.orgId])).rows[0];
      if (!a) throw new UserError("ไม่พบผู้สมัคร");
      if (a.erased_at) throw new UserError("ลบข้อมูลไปแล้ว");
      const subs = (await c.query(`select id from form_submissions where applicant_id = $1 or id = (select source_submission from kol_applicants where id = $1)`, [id])).rows.map((r) => r.id);
      await c.query(`delete from form_files where submission_id = any($1)`, [subs]);
      await c.query(`update form_submissions set answers = '{}', internal_note = null, ip_hash = null, user_agent = null where id = any($1)`, [subs]);
      await c.query(`delete from form_submission_edits where submission_id = any($1)`, [subs]);
      await c.query(`delete from kol_social_accounts where applicant_id = $1`, [id]);
      await c.query(`delete from kol_comments where applicant_id = $1`, [id]);
      await c.query(`update kol_reviews set body = null where applicant_id = $1`, [id]);
      await c.query(`update kol_access_tokens set revoked_at = coalesce(revoked_at, now()), token_enc = null where applicant_id = $1`, [id]);
      await c.query(`update kol_registrations set membership_name = null, notes = null where applicant_id = $1`, [id]);
      await c.query(
        `update kol_applicants set full_name = 'ลบข้อมูลแล้ว', creator_name = $2, phone = null, line_id = null, email = null, photo_file_id = null,
                bio = null, motivation = null, sample_links = '{}', erased_at = now(), updated_at = now() where id = $1`, [id, applicantRef(a.ref_no)]);
      await audit(c, u.orgId, u.id, "kol_applicant.erased", "kol_applicant", id, null, { ref: applicantRef(a.ref_no) });
    });
  } catch (err) { return handle(err); }
  revalidateKol();
  redirect("/kol?erased=1");
}

// ================================================================ campaign tracking
async function participantGuard(c: PoolClient, u: CurrentUser, id: string) {
  const p = (await c.query(`select * from kol_participants where id = $1 and org_id = $2 for update`, [id, u.orgId])).rows[0];
  if (!p) throw new UserError("ไม่พบ KOL ในแคมเปญนี้");
  return p;
}
const optInt = (fd: FormData, k: string) => { const s = str(fd, k, 20).replace(/,/g, ""); if (!s) return null; const n = Number(s); if (!Number.isInteger(n) || n < 0) throw new UserError("ตัวเลขต้องเป็นจำนวนเต็มไม่ติดลบ"); return n; };

export async function updateVisit(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  const fields = fieldsOf(fd);
  if (typeof u === "string") return { error: u, fields };
  const id = str(fd, "participant_id");
  const date = str(fd, "visit_date", 10) || null;
  const time = str(fd, "visit_time", 5) || null;
  const status = str(fd, "visit_status");
  const coach = str(fd, "coach");
  if (!isUuid(id)) return { error: "ไม่พบ KOL", fields };
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "วันที่ไม่ถูกต้อง", fields };
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: "เวลาไม่ถูกต้อง", fields };
  if (!(VISIT_STATUSES as readonly string[]).includes(status)) return { error: "เลือกสถานะการนัดหมาย", fields };
  if (["scheduled", "confirmed", "visited"].includes(status) && !date) return { error: "สถานะนี้ต้องมีวันนัด", fields };
  try {
    await withTransaction(async (c) => {
      const p = await participantGuard(c, u, id);
      const after = { visit_date: date, visit_time: time, visit_status: status, coach_required: coach === "yes" ? true : coach === "no" ? false : null };
      await c.query(`update kol_participants set visit_date = $2, visit_time = $3, visit_status = $4, coach_required = $5, updated_at = now() where id = $1`,
        [id, date, time, status, after.coach_required]);
      await audit(c, u.orgId, u.id, "kol_participant.visit_updated", "kol_participant", id,
        { visit_date: p.visit_date, visit_time: p.visit_time, visit_status: p.visit_status, coach_required: p.coach_required }, after);
    });
  } catch (err) { return handle(err, fields); }
  revalidateKol();
  return { ok: "บันทึกการนัดหมายแล้ว" };
}

export async function updateParticipant(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  const fields = fieldsOf(fd);
  if (typeof u === "string") return { error: u, fields };
  const id = str(fd, "participant_id");
  const status = str(fd, "status");
  if (!isUuid(id) || !["active", "completed", "cancelled"].includes(status)) return { error: "ข้อมูลไม่ถูกต้อง", fields };
  const notes = str(fd, "notes", 4000) || null;
  try {
    await withTransaction(async (c) => {
      const p = await participantGuard(c, u, id);
      await c.query(`update kol_participants set status = $2, notes = $3, updated_at = now() where id = $1`, [id, status, notes]);
      await audit(c, u.orgId, u.id, "kol_participant.updated", "kol_participant", id, { status: p.status, notes: p.notes }, { status, notes });
    });
  } catch (err) { return handle(err, fields); }
  revalidateKol();
  return { ok: "บันทึกแล้ว" };
}

export async function updateDeliverable(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  const fields = fieldsOf(fd);
  if (typeof u === "string") return { error: u, fields };
  const id = str(fd, "deliverable_id");
  const status = str(fd, "status");
  const rawUrl = str(fd, "url", 500);
  if (!isUuid(id) || !(DELIVERABLE_STATUSES as readonly string[]).includes(status)) return { error: "ข้อมูลไม่ถูกต้อง", fields };
  let url: string | null = null;
  if (rawUrl) {
    try { const x = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`); url = x.toString(); } catch { return { error: "ลิงก์ผลงานไม่ถูกต้อง", fields }; }
  }
  if ((status === "submitted" || status === "verified") && !url) return { error: "ใส่ลิงก์ผลงานที่โพสต์จริงก่อนเปลี่ยนเป็นส่งแล้ว / ตรวจแล้ว", fields };
  try {
    await withTransaction(async (c) => {
      const d = (await c.query(`select d.*, p.applicant_id, a.ref_no, a.creator_name from kol_deliverables d join kol_participants p on p.id = d.participant_id
                                 join kol_applicants a on a.id = p.applicant_id where d.id = $1 and d.org_id = $2 for update of d`, [id, u.orgId])).rows[0];
      if (!d) throw new UserError("ไม่พบรายการผลงาน");
      const metrics = { views: optInt(fd, "views"), likes: optInt(fd, "likes"), comments: optInt(fd, "comments"), shares: optInt(fd, "shares") };
      const anyMetric = Object.values(metrics).some((v) => v !== null);
      const metricsChanged = ["views", "likes", "comments", "shares"].some((k) => (d[k] ?? null) !== metrics[k as keyof typeof metrics]);
      await c.query(
        `update kol_deliverables set status = $2, url = $3, submitted_at = case when $2 in ('submitted','verified') then coalesce(submitted_at, now()) else null end,
                verified_at = case when $2 = 'verified' then coalesce(verified_at, now()) else null end,
                verified_by = case when $2 = 'verified' then coalesce(verified_by, $4) else null end,
                views = $5, likes = $6, comments = $7, shares = $8,
                metrics_source = case when $9 then 'manual' else null end,
                metrics_updated_at = case when $10 then now() else metrics_updated_at end, metrics_updated_by = case when $10 then $4 else metrics_updated_by end,
                note = $11, updated_at = now() where id = $1`,
        [id, status, url, u.id, metrics.views, metrics.likes, metrics.comments, metrics.shares, anyMetric, metricsChanged, str(fd, "note", 1000) || null]);
      await audit(c, u.orgId, u.id, "kol_deliverable.updated", "kol_deliverable", id, { status: d.status, url: d.url }, { status, url, ...metrics });
      if (status === "submitted" && d.status !== "submitted") {
        await notifyPermission(c, u.orgId, "kol.review", u.id, "คอนเทนต์รอตรวจ", `${applicantRef(d.ref_no)} ${d.creator_name} · ${d.label}`, `/kol/campaign/${d.participant_id}`, `kol:del:${id}:submitted`);
      }
      const left = (await c.query(`select count(*)::int as n from kol_deliverables where participant_id = $1 and status <> 'verified'`, [d.participant_id])).rows[0].n;
      if (left === 0) {
        await notifyPermission(c, u.orgId, "kol.view", null, "KOL ส่งผลงานครบแล้ว", `${applicantRef(d.ref_no)} ${d.creator_name}`, `/kol/campaign/${d.participant_id}`, `kol:done:${d.participant_id}`);
      }
    });
  } catch (err) { return handle(err, fields); }
  revalidateKol();
  return { ok: "บันทึกผลงานแล้ว" };
}

export async function addCreditEntry(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  const fields = fieldsOf(fd);
  if (typeof u === "string") return { error: u, fields };
  const id = str(fd, "participant_id");
  const kind = str(fd, "kind") === "adjustment" ? "adjustment" : "usage";
  const hours = Number(str(fd, "hours", 10));
  const on = str(fd, "occurred_on", 10);
  if (!isUuid(id)) return { error: "ไม่พบ KOL", fields };
  if (!Number.isFinite(hours) || hours === 0 || Math.abs(hours) > 100 || Math.round(hours * 4) !== hours * 4) return { error: "จำนวนชั่วโมงต้องเป็นทีละ 0.25 ชม. และไม่เกิน 100", fields };
  if (kind === "usage" && hours < 0) return { error: "ชั่วโมงที่ใช้ต้องมากกว่า 0", fields };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return { error: "เลือกวันที่", fields };
  if (kind === "adjustment" && !str(fd, "note")) return { error: "ระบุเหตุผลของการปรับเครดิต", fields };
  try {
    await withTransaction(async (c) => {
      await participantGuard(c, u, id);
      const sums = (await c.query(
        `select coalesce(sum(hours) filter (where kind in ('entitlement','adjustment')), 0) as ent, coalesce(sum(hours) filter (where kind = 'usage'), 0) as used
           from kol_court_credits where participant_id = $1`, [id])).rows[0];
      const remaining = Number(sums.ent) - Number(sums.used);
      if (kind === "usage" && hours > remaining + 1e-9) throw new UserError(`เครดิตคงเหลือไม่พอ (เหลือ ${remaining} ชม.)`);
      if (kind === "adjustment" && remaining + hours < -1e-9) throw new UserError("ปรับแล้วเครดิตคงเหลือจะติดลบ");
      await c.query(
        `insert into kol_court_credits (org_id, participant_id, kind, hours, occurred_on, source, booking_ref, note, created_by) values ($1,$2,$3,$4,$5,'internal_tracking',$6,$7,$8)`,
        [u.orgId, id, kind, hours, on, str(fd, "booking_ref", 80) || null, str(fd, "note", 500) || null, u.id]);
      await audit(c, u.orgId, u.id, `kol_credit.${kind}`, "kol_participant", id, { remaining }, { hours, on, internal_tracking: true });
    });
  } catch (err) { return handle(err, fields); }
  revalidateKol();
  return { ok: "บันทึกเครดิต (ติดตามภายใน) แล้ว" };
}

export async function createPromoCode(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  const fields = fieldsOf(fd);
  if (typeof u === "string") return { error: u, fields };
  const id = str(fd, "participant_id");
  const code = str(fd, "code", 40).toUpperCase().replace(/\s+/g, "");
  const pct = Number(str(fd, "discount_pct", 6));
  const until = str(fd, "valid_until", 10) || null;
  if (!isUuid(id)) return { error: "ไม่พบ KOL", fields };
  if (!isPromoCode(code)) return { error: "โค้ดใช้ได้เฉพาะ A–Z, 0–9, - และ _ (3–40 ตัว)", fields };
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return { error: "ส่วนลดต้องอยู่ระหว่าง 1–100%", fields };
  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return { error: "วันหมดอายุไม่ถูกต้อง", fields };
  try {
    await withTransaction(async (c) => {
      await participantGuard(c, u, id);
      await c.query(`insert into kol_promo_codes (org_id, participant_id, code, discount_bps, max_uses, valid_until, created_by) values ($1,$2,$3,$4,$5,$6,$7)`,
        [u.orgId, id, code, Math.round(pct * 100), optInt(fd, "max_uses"), until, u.id]);
      await audit(c, u.orgId, u.id, "kol_promo.created", "kol_participant", id, null, { code, pct, until });
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return { error: `โค้ด ${code} ถูกใช้แล้ว ตั้งโค้ดใหม่`, fields };
    return handle(err, fields);
  }
  revalidateKol();
  return { ok: `บันทึกโค้ด ${code} แล้ว` };
}

export async function voidPromoCode(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  if (typeof u === "string") return { error: u };
  const id = str(fd, "promo_id");
  if (!isUuid(id)) return { error: "ไม่พบโค้ด" };
  try {
    await withTransaction(async (c) => {
      const r = (await c.query(`update kol_promo_codes set status = 'void' where id = $1 and org_id = $2 and status = 'active' returning code, participant_id`, [id, u.orgId])).rows[0];
      if (!r) throw new UserError("โค้ดนี้ถูกยกเลิกไปแล้ว");
      await audit(c, u.orgId, u.id, "kol_promo.voided", "kol_participant", r.participant_id, null, { code: r.code });
    });
  } catch (err) { return handle(err); }
  revalidateKol();
  return { ok: "ยกเลิกโค้ดแล้ว" };
}

/** Campaign template: saving creates a new terms version. Participants keep the version (and deliverables) they joined with. */
export async function saveCampaignTerms(_prev: FormState, fd: FormData): Promise<FormState> {
  const u = await actor("kol.review");
  const fields = fieldsOf(fd);
  if (typeof u === "string") return { error: u, fields };
  const campaignId = str(fd, "campaign_id");
  const title = str(fd, "title", 160);
  const items = str(fd, "items", 6000).split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 30);
  const delivs = str(fd, "deliverables", 3000).split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20);
  if (!isUuid(campaignId)) return { error: "ไม่พบแคมเปญ", fields };
  if (!title || !items.length) return { error: "กรอกชื่อและเงื่อนไขอย่างน้อย 1 บรรทัด", fields };
  if (!delivs.length) return { error: "กรอกรายการผลงานที่ต้องส่งอย่างน้อย 1 รายการ", fields };
  const num = (k: string, lo: number, hi: number, allowNull = false) => {
    const s = str(fd, k, 20).replace(/,/g, "");
    if (!s && allowNull) return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < lo || n > hi) throw new UserError("ตัวเลขบางช่องไม่ถูกต้อง");
    return n;
  };
  try {
    await withTransaction(async (c) => {
      const cur = await currentTerms(campaignId, c);
      if (!cur || (await c.query(`select 1 from kol_campaigns where campaign_id = $1 and org_id = $2`, [campaignId, u.orgId])).rowCount === 0) throw new UserError("ไม่พบแคมเปญ");
      const used = new Set<string>();
      const deliverables = delivs.map((label, i) => {
        const prev = cur.deliverables.find((d) => d.label === label);
        let key = prev?.key ?? `d_${(label.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "item").slice(0, 30)}`;
        while (used.has(key)) key = `${key.slice(0, 34)}_${i}`;
        used.add(key);
        return { key, label: label.slice(0, 120) };
      });
      const vals = [num("credit_hours", 0, 1000), Math.round(num("credit_value", 0, 10_000_000)! * 100), Math.round(num("promo_pct", 0, 100)! * 100),
        num("promo_max_uses", 1, 100000, true), num("promo_valid_days", 1, 3650, true), num("min_followers", 0, 100_000_000), num("deliver_within_days", 1, 365, true)];
      await c.query(`update kol_campaign_terms set is_current = false where campaign_id = $1 and is_current`, [campaignId]);
      const row = (await c.query(
        `insert into kol_campaign_terms (org_id, campaign_id, version_no, title, items, deliverables, credit_hours, credit_value_satang, promo_discount_bps,
                                         promo_max_uses, promo_valid_days, min_followers, deliver_within_days, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning version_no`,
        [u.orgId, campaignId, cur.versionNo + 1, title, items, JSON.stringify(deliverables), ...vals, u.id])).rows[0];
      await audit(c, u.orgId, u.id, "kol_terms.versioned", "campaign", campaignId, { version: cur.versionNo }, { version: row.version_no, title, items, deliverables });
    });
  } catch (err) { return handle(err, fields); }
  revalidateKol();
  revalidatePath("/f", "layout");
  return { ok: "บันทึกเงื่อนไขเวอร์ชันใหม่แล้ว ผู้เข้าร่วมเดิมใช้เงื่อนไขเวอร์ชันเดิมต่อ" };
}
