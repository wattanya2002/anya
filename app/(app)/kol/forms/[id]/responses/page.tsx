import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Download, FileSpreadsheet, Search } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { getForm, listResponses, responseColumns } from "@/lib/forms-server";
import { displayAnswer, type AnswerValue, type FieldType } from "@/lib/forms-core";
import { applicantRef, submissionRef } from "@/lib/kol-core";
import { Empty, fmtDateTime } from "@/components/kol/ui";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ResponsesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const user = await requireUser();
  if (!can(user, "forms.responses")) notFound();
  const { id } = await params;
  const sp = await searchParams;
  const form = await getForm(user.orgId, id);
  if (!form) notFound();
  const q = one(sp.q).trim().slice(0, 80);
  const version = Number(one(sp.version)) || null;
  const flag = one(sp.flag) === "incomplete" ? "incomplete" : one(sp.flag) === "edited" ? "edited" : null;
  const [rows, cols, versions] = await Promise.all([
    listResponses(user.orgId, form.id, { q, version, flag, limit: 300 }), responseColumns(form.id),
    db().query(`select version_no from form_versions where form_id = $1 order by version_no desc`, [form.id]),
  ]);
  const summary = cols.filter((c) => !["file", "image", "consent", "checkbox", "long_text"].includes(c.type)).slice(0, 3);
  const exportQs = new URLSearchParams({ ...(q ? { q } : {}), ...(version ? { version: String(version) } : {}), ...(flag ? { flag } : {}) });
  return (
    <>
      <Link href="/kol/forms" className="k-back"><ArrowLeft aria-hidden="true" />Form Dashboard</Link>
      <div className="k-head" style={{ marginTop: 4 }}>
        <h1 className="k-title" style={{ fontSize: 19 }}>คำตอบ: {form.title}<small>&nbsp;· {form.responses.toLocaleString("en-US")} ราย</small></h1>
        <div className="k-actions">
          <a className="k-btn sm soft" href={`/kol/forms/${form.id}/export?${new URLSearchParams({ ...Object.fromEntries(exportQs), format: "csv" })}`}><Download aria-hidden="true" />Export CSV</a>
          <a className="k-btn sm primary" href={`/kol/forms/${form.id}/export?${new URLSearchParams({ ...Object.fromEntries(exportQs), format: "xlsx" })}`}><FileSpreadsheet aria-hidden="true" />Export Excel</a>
        </div>
      </div>
      <form className="k-card k-filters" role="search" style={{ marginTop: 22 }}>
        <label className="k-field"><span>ค้นหาในคำตอบ</span><input className="k-input" type="search" name="q" defaultValue={q} placeholder="คำใดก็ได้ หรือเลขอ้างอิง" maxLength={80} /></label>
        <label className="k-field"><span>เวอร์ชันฟอร์ม</span>
          <select className="k-select" name="version" defaultValue={version ?? ""}><option value="">ทุกเวอร์ชัน</option>{versions.rows.map((v) => <option key={v.version_no} value={v.version_no}>v{v.version_no}</option>)}</select></label>
        <label className="k-field"><span>สถานะคำตอบ</span>
          <select className="k-select" name="flag" defaultValue={flag ?? ""}><option value="">ทั้งหมด</option><option value="incomplete">ไม่สมบูรณ์</option><option value="edited">มีการแก้ไข</option></select></label>
        <span />
        <div className="k-actions"><button type="submit" className="k-btn primary"><Search aria-hidden="true" />กรอง</button></div>
      </form>
      {rows.length === 0 ? <div className="k-card" style={{ marginTop: 22 }}><Empty title={form.responses ? "ไม่พบคำตอบตามเงื่อนไข" : "ยังไม่มีคำตอบ"} /></div> : (
        <div className="k-card" style={{ marginTop: 22, padding: 0 }}>
          <div className="k-table-wrap" style={{ border: 0 }}>
            <table className="k-table">
              <thead><tr><th>เลขอ้างอิง</th><th>ส่งเมื่อ</th>{summary.map((c) => <th key={c.key}>{c.label}</th>)}<th>เวอร์ชัน</th><th>สถานะ</th><th><span className="sr-only">เปิด</span></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.applicantRef ? applicantRef(r.applicantRef) : submissionRef(r.refNo)}</b></td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(r.submittedAt)}</td>
                    {summary.map((c) => <td key={c.key} style={{ maxWidth: 220, overflowWrap: "anywhere" }}>{displayAnswer({ type: c.type as FieldType, options: c.options ?? undefined }, r.answers[c.key] as AnswerValue) || "–"}</td>)}
                    <td>v{r.versionNo}</td>
                    <td>{r.incomplete ? <span className="k-badge" data-tone="amber">ไม่สมบูรณ์</span> : r.editCount ? <span className="k-badge" data-tone="purple">แก้ไข {r.editCount}</span> : <span className="k-badge" data-tone="green">ครบ</span>}</td>
                    <td><Link href={`/kol/forms/${form.id}/responses/${r.id}`} className="k-btn sm soft" aria-label={`เปิดคำตอบ ${submissionRef(r.refNo)}`}>เปิด<ChevronRight aria-hidden="true" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
