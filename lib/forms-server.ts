import "server-only";
import type { PoolClient } from "pg";
import { db } from "./db";
import { allFields, normalizeSchema, type FormSchema, type Purpose, type Answers } from "./forms-core";

export type FormRow = {
  id: string; orgId: string; purpose: Purpose; systemKey: string | null; title: string; slug: string; status: "draft" | "published" | "closed";
  campaignId: string | null; draft: FormSchema; draftRev: number; draftDirty: boolean; currentVersionId: string | null;
  versionNo: number | null; publishedAt: Date | null; updatedAt: Date; createdAt: Date; responses: number; lastResponseAt: Date | null;
};

const FORM_SQL = `
  select f.*, v.version_no, v.published_at,
         (select count(*)::int from form_submissions s where s.form_id = f.id) as responses,
         (select max(s.submitted_at) from form_submissions s where s.form_id = f.id) as last_response_at
    from forms f left join form_versions v on v.id = f.current_version_id`;

function toForm(r: Record<string, unknown>): FormRow {
  return {
    id: r.id as string, orgId: r.org_id as string, purpose: r.purpose as Purpose, systemKey: r.system_key as string | null, title: r.title as string,
    slug: r.slug as string, status: r.status as FormRow["status"], campaignId: r.campaign_id as string | null, draft: normalizeSchema(r.draft),
    draftRev: r.draft_rev as number, draftDirty: r.draft_dirty as boolean, currentVersionId: r.current_version_id as string | null,
    versionNo: (r.version_no as number | null) ?? null, publishedAt: (r.published_at as Date | null) ?? null, updatedAt: r.updated_at as Date,
    createdAt: r.created_at as Date, responses: r.responses as number, lastResponseAt: (r.last_response_at as Date | null) ?? null,
  };
}

export async function listForms(orgId: string): Promise<FormRow[]> {
  const { rows } = await db().query(`${FORM_SQL} where f.org_id = $1 order by (f.system_key is null), f.created_at`, [orgId]);
  return rows.map(toForm);
}
export async function getForm(orgId: string, id: string): Promise<FormRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows } = await db().query(`${FORM_SQL} where f.org_id = $1 and f.id = $2`, [orgId, id]);
  return rows[0] ? toForm(rows[0]) : null;
}
export async function getFormBySystemKey(orgId: string, key: string): Promise<FormRow | null> {
  const { rows } = await db().query(`${FORM_SQL} where f.org_id = $1 and f.system_key = $2`, [orgId, key]);
  return rows[0] ? toForm(rows[0]) : null;
}

export type PublishedForm = {
  formId: string; orgId: string; slug: string; title: string; purpose: Purpose; status: FormRow["status"]; campaignId: string | null;
  versionId: string; versionNo: number; schema: FormSchema; termsId: string | null;
};
async function published(where: string, args: unknown[]): Promise<PublishedForm | null> {
  const { rows } = await db().query(
    `select f.id, f.org_id, f.slug, f.title, f.purpose, f.status, f.campaign_id, v.id as version_id, v.version_no, v.schema, v.terms_id
       from forms f join form_versions v on v.id = f.current_version_id where ${where}`, args);
  const r = rows[0];
  if (!r) return null;
  return { formId: r.id, orgId: r.org_id, slug: r.slug, title: r.title, purpose: r.purpose, status: r.status, campaignId: r.campaign_id,
    versionId: r.version_id, versionNo: r.version_no, schema: normalizeSchema(r.schema), termsId: r.terms_id };
}
export const publishedBySlug = (slug: string) => /^[a-z0-9-]{3,61}$/.test(slug) ? published(`f.slug = $1`, [slug]) : Promise.resolve(null);
export const publishedByKey = (orgId: string, key: string) => published(`f.org_id = $1 and f.system_key = $2`, [orgId, key]);
export const publishedById = (id: string) => published(`f.id = $1`, [id]);

export async function versionSchema(versionId: string): Promise<{ schema: FormSchema; versionNo: number } | null> {
  const { rows } = await db().query(`select schema, version_no from form_versions where id = $1`, [versionId]);
  return rows[0] ? { schema: normalizeSchema(rows[0].schema), versionNo: rows[0].version_no } : null;
}

/** Snapshot the schema as a new version and point the form at it. Caller holds the form row lock. */
export async function publishVersion(c: PoolClient, o: { orgId: string; formId: string; schema: FormSchema; userId: string | null; termsId: string | null }): Promise<{ versionId: string; versionNo: number }> {
  const next = (await c.query(`select coalesce(max(version_no), 0) + 1 as n from form_versions where form_id = $1`, [o.formId])).rows[0].n as number;
  const v = (await c.query(
    `insert into form_versions (org_id, form_id, version_no, schema, terms_id, published_by) values ($1,$2,$3,$4,$5,$6) returning id`,
    [o.orgId, o.formId, next, JSON.stringify(o.schema), o.termsId, o.userId])).rows[0].id as string;
  let pos = 0;
  for (const sec of o.schema.sections) {
    for (const f of sec.fields) {
      await c.query(
        `insert into form_fields (org_id, form_id, version_id, field_key, section_key, position, type, label, required, maps_to, config)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [o.orgId, o.formId, v, f.key, sec.key, pos++, f.type, f.label, f.required, f.mapsTo ?? null,
          JSON.stringify({ options: f.options ?? null, validation: f.validation ?? null, showIf: f.showIf ?? null })]);
    }
  }
  await c.query(
    `update forms set current_version_id = $2, status = 'published', closed_at = null, draft_dirty = false, updated_at = now() where id = $1`, [o.formId, v]);
  return { versionId: v, versionNo: next };
}

// ---------------------------------------------------------------- responses
export type ResponseRow = {
  id: string; refNo: number; versionId: string; versionNo: number; answers: Answers; submittedAt: Date; updatedAt: Date; incomplete: boolean;
  internalNote: string | null; applicantId: string | null; applicantRef: number | null; editCount: number;
};
export async function listResponses(orgId: string, formId: string, o: { q?: string; version?: number | null; flag?: "incomplete" | "edited" | null; limit?: number } = {}): Promise<ResponseRow[]> {
  const args: unknown[] = [orgId, formId];
  let where = `s.org_id = $1 and s.form_id = $2`;
  if (o.q) {
    args.push(`%${o.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
    const p = args.length;
    args.push(o.q.replace(/\D/g, "") || "-1");
    where += ` and (s.answers::text ilike $${p} or s.ref_no::text = $${args.length} or coalesce(s.internal_note, '') ilike $${p})`;
  }
  if (o.version) { args.push(o.version); where += ` and v.version_no = $${args.length}`; }
  if (o.flag === "incomplete") where += ` and s.incomplete`;
  if (o.flag === "edited") where += ` and exists (select 1 from form_submission_edits e where e.submission_id = s.id)`;
  args.push(Math.min(o.limit ?? 500, 5000));
  const { rows } = await db().query(
    `select s.id, s.ref_no, s.version_id, v.version_no, s.answers, s.submitted_at, s.updated_at, s.incomplete, s.internal_note, s.applicant_id,
            a.ref_no as applicant_ref, (select count(*)::int from form_submission_edits e where e.submission_id = s.id) as edit_count
       from form_submissions s join form_versions v on v.id = s.version_id left join kol_applicants a on a.id = s.applicant_id
      where ${where} order by s.submitted_at desc limit $${args.length}`, args);
  return rows.map((r) => ({
    id: r.id, refNo: r.ref_no, versionId: r.version_id, versionNo: r.version_no, answers: r.answers, submittedAt: r.submitted_at, updatedAt: r.updated_at,
    incomplete: r.incomplete, internalNote: r.internal_note, applicantId: r.applicant_id, applicantRef: r.applicant_ref, editCount: r.edit_count,
  }));
}

/** Column list across every published version: stable keys, label from the newest version that has the field. */
export async function responseColumns(formId: string): Promise<{ key: string; label: string; type: string; options: { value: string; label: string }[] | null }[]> {
  const { rows } = await db().query(
    `select distinct on (ff.field_key) ff.field_key, ff.label, ff.type, ff.config->'options' as options, v.version_no, ff.position
       from form_fields ff join form_versions v on v.id = ff.version_id where ff.form_id = $1
      order by ff.field_key, v.version_no desc`, [formId]);
  return rows.sort((a, b) => b.version_no - a.version_no || a.position - b.position)
    .map((r) => ({ key: r.field_key, label: r.label, type: r.type, options: r.options }));
}

export type FileMeta = { id: string; name: string; size: number; mime: string };
export async function filesOfSubmission(submissionId: string): Promise<Record<string, FileMeta[]>> {
  const { rows } = await db().query(
    `select id, field_key, file_name, size_bytes, mime from form_files where submission_id = $1 order by created_at`, [submissionId]);
  const out: Record<string, FileMeta[]> = {};
  for (const r of rows) (out[r.field_key] ??= []).push({ id: r.id, name: r.file_name, size: r.size_bytes, mime: r.mime });
  return out;
}

export const allFieldKeys = (s: FormSchema) => allFields(s).map((f) => f.key);
