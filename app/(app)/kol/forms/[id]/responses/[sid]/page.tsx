import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, History, NotebookPen, Pencil } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { filesOfSubmission } from "@/lib/forms-server";
import { allFields, displayAnswer, isChoice, isFileType, normalizeSchema, type AnswerValue, type Field } from "@/lib/forms-core";
import { applicantRef, submissionRef } from "@/lib/kol-core";
import { fmtDateTime } from "@/components/kol/ui";
import { ActionForm } from "@/components/kol/client";
import { editAnswer, saveResponseInternal } from "../../../../actions";

export default async function ResponsePage({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const user = await requireUser();
  if (!can(user, "forms.responses")) notFound();
  const { id, sid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sid)) notFound();
  const r = (await db().query(
    `select s.*, v.schema, v.version_no, f.title as form_title, a.ref_no as a_ref, a.id as a_id, u.display_name as updater
       from form_submissions s join form_versions v on v.id = s.version_id join forms f on f.id = s.form_id
       left join kol_applicants a on a.id = s.applicant_id left join users u on u.id = s.updated_by
      where s.id = $1 and s.form_id = $2 and s.org_id = $3`, [sid, id, user.orgId])).rows[0];
  if (!r) notFound();
  const schema = normalizeSchema(r.schema);
  const [files, edits] = await Promise.all([
    filesOfSubmission(sid),
    db().query(`select e.*, u.display_name from form_submission_edits e join users u on u.id = e.edited_by where e.submission_id = $1 order by e.edited_at desc`, [sid]),
  ]);
  const canEdit = can(user, "forms.edit_responses");
  const label = (k: string) => allFields(schema).find((f) => f.key === k)?.label ?? k;
  return (
    <>
      <Link href={`/kol/forms/${id}/responses`} className="k-back"><ArrowLeft aria-hidden="true" />คำตอบทั้งหมด</Link>
      <section className="k-card" style={{ marginTop: 8 }}>
        <h1 style={{ margin: 0, fontSize: 19 }}>{r.a_ref ? applicantRef(r.a_ref) : submissionRef(r.ref_no)} · {r.form_title}</h1>
        <p className="k-muted k-small" style={{ margin: "6px 0 0" }}>ส่งเมื่อ {fmtDateTime(r.submitted_at)} · ตอบบนฟอร์มเวอร์ชัน {r.version_no}{r.updater ? ` · แก้ไขล่าสุดโดย ${r.updater} ${fmtDateTime(r.updated_at)}` : ""}</p>
        <div className="k-row" style={{ marginTop: 8 }}>
          {r.incomplete && <span className="k-badge" data-tone="amber">ไม่สมบูรณ์</span>}
          {r.a_id && can(user, "kol.view") && <Link className="k-btn sm soft" href={`/kol/applicants/${r.a_id}`}>เปิดหน้าผู้สมัคร</Link>}
        </div>
      </section>

      <div className="k-grid two">
        <section className="k-card" aria-labelledby="rs-a">
          <div className="k-card-h"><h2 id="rs-a"><Pencil aria-hidden="true" />คำตอบ</h2></div>
          <dl className="k-kv">
            {allFields(schema).map((f) => {
              const v = r.answers[f.key] as AnswerValue | undefined;
              if (isFileType(f.type)) {
                const list = files[f.key] ?? [];
                return <div key={f.key}><dt>{f.label}</dt><dd>{list.length ? <ul className="k-files">{list.map((x) => <li key={x.id}><a href={`/api/kol/files/${x.id}`} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" />{x.name}</a></li>)}</ul> : <span className="k-muted">—</span>}</dd></div>;
              }
              return (
                <div key={f.key}><dt>{f.label}</dt><dd>
                  {displayAnswer(f, v) || <span className="k-muted">ไม่ได้ตอบ</span>}
                  {canEdit && (
                    <details style={{ marginTop: 6 }}>
                      <summary className="k-btn sm ghost" style={{ listStyle: "none", width: "fit-content" }}>แก้ไข</summary>
                      <ActionForm action={editAnswer} submitLabel="บันทึกการแก้ไข" submitClass="k-btn sm primary">
                        <input type="hidden" name="submission_id" value={sid} /><input type="hidden" name="field_key" value={f.key} />
                        <ValueInput f={f} v={v} />
                        <label className="k-field" style={{ marginTop: 8 }}><span className="k-label">เหตุผลที่แก้ (บันทึกในประวัติ)</span><input className="k-input" name="reason" maxLength={500} /></label>
                      </ActionForm>
                    </details>
                  )}
                </dd></div>
              );
            })}
          </dl>
        </section>
        <div className="k-stack">
          <section className="k-card" aria-labelledby="rs-i">
            <div className="k-card-h"><h2 id="rs-i"><NotebookPen aria-hidden="true" />ข้อมูลภายในของทีม</h2></div>
            <ActionForm action={saveResponseInternal} submitLabel="บันทึก" submitClass="k-btn sm primary">
              <input type="hidden" name="submission_id" value={sid} />
              <label className="k-field"><span className="k-label">หมายเหตุภายใน</span><textarea className="k-textarea" name="internal_note" defaultValue={r.internal_note ?? ""} maxLength={4000} /></label>
              <label className="k-check"><input type="checkbox" name="incomplete" defaultChecked={r.incomplete} />ระบุว่าคำตอบนี้ไม่สมบูรณ์</label>
            </ActionForm>
          </section>
          <section className="k-card" aria-labelledby="rs-h">
            <div className="k-card-h"><h2 id="rs-h"><History aria-hidden="true" />ประวัติการแก้ไข</h2></div>
            {edits.rows.length === 0 ? <p className="k-muted k-small" style={{ margin: 0 }}>ยังไม่มีการแก้ไข</p> : (
              <ul className="k-timeline">{edits.rows.map((e) => (
                <li key={e.id}><div><b>{label(e.field_key)}</b><br /><small>{e.display_name} · {fmtDateTime(e.edited_at)}</small>
                  <p style={{ margin: "3px 0 0" }}>{JSON.stringify(e.before) ?? "–"} → {JSON.stringify(e.after) ?? "–"}{e.reason ? ` · ${e.reason}` : ""}</p></div></li>
              ))}</ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function ValueInput({ f, v }: { f: Field; v: AnswerValue | undefined }) {
  if (f.type === "multiple_choice") {
    const sel = Array.isArray(v) ? (v as string[]) : [];
    return (
      <fieldset style={{ border: 0, padding: 0, margin: "8px 0 0" }}><legend className="sr-only">{f.label}</legend>
        <input type="hidden" name="json" value="1" />
        <MultiHidden options={f.options ?? []} selected={sel} />
      </fieldset>
    );
  }
  if (isChoice(f.type)) {
    return <select className="k-select" name="value" defaultValue={typeof v === "string" ? v : ""} style={{ marginTop: 8 }}><option value="">— ไม่มีคำตอบ —</option>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
  }
  if (f.type === "checkbox" || f.type === "consent") {
    return <select className="k-select" name="value" defaultValue={v === true ? "true" : "false"} style={{ marginTop: 8 }}><option value="true">ใช่</option><option value="false">ไม่</option></select>;
  }
  if (f.type === "long_text") return <textarea className="k-textarea" name="value" defaultValue={typeof v === "string" ? v : ""} style={{ marginTop: 8 }} />;
  const type = f.type === "date" ? "date" : f.type === "time" ? "time" : f.type === "email" ? "email" : f.type === "url" ? "url" : "text";
  return <input className="k-input" name="value" type={type} defaultValue={v === undefined || v === null ? "" : String(v)} style={{ marginTop: 8 }} />;
}

/** Multiple-choice editing without client JS: one checkbox per option; the server receives them as a JSON array. */
function MultiHidden({ options, selected }: { options: { value: string; label: string }[]; selected: string[] }) {
  return (
    <>
      {options.map((o) => <label key={o.value} className="k-check" style={{ minHeight: 36, padding: "4px 0" }}><input type="checkbox" name="multi" value={o.value} defaultChecked={selected.includes(o.value)} />{o.label}</label>)}
    </>
  );
}
