import ExcelJS from "exceljs";
import { getCurrentUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { getForm, listResponses, responseColumns } from "@/lib/forms-server";
import { csvCell, displayAnswer, type AnswerValue, type FieldType } from "@/lib/forms-core";
import { applicantRef, submissionRef } from "@/lib/kol-core";

export const runtime = "nodejs";
const bkk = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }).format(d);

/** CSV / Excel export of a form's responses (all versions; columns keyed by the stable field id). Logged in audit_events. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!can(user, "forms.responses")) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const form = await getForm(user.orgId, id);
  if (!form) return new Response("Not found", { status: 404 });
  const sp = new URL(req.url).searchParams;
  const flag = sp.get("flag") === "incomplete" ? "incomplete" : sp.get("flag") === "edited" ? "edited" : null;
  const [rows, cols] = await Promise.all([
    listResponses(user.orgId, form.id, { q: (sp.get("q") ?? "").slice(0, 80), version: Number(sp.get("version")) || null, flag, limit: 5000 }),
    responseColumns(form.id),
  ]);
  const files = rows.length ? (await db().query(`select submission_id, field_key, file_name from form_files where submission_id = any($1) order by created_at`, [rows.map((r) => r.id)])).rows : [];
  const fileMap = new Map<string, string[]>();
  for (const f of files) { const k = `${f.submission_id}:${f.field_key}`; fileMap.set(k, [...(fileMap.get(k) ?? []), f.file_name]); }
  const header = ["เลขอ้างอิง", "ส่งเมื่อ (เวลาไทย)", "เวอร์ชันฟอร์ม", ...cols.map((c) => c.label), "ไม่สมบูรณ์", "หมายเหตุภายใน"];
  const data = rows.map((r) => [
    r.applicantRef ? applicantRef(r.applicantRef) : submissionRef(r.refNo), bkk(r.submittedAt), `v${r.versionNo}`,
    ...cols.map((c) => (c.type === "file" || c.type === "image") ? (fileMap.get(`${r.id}:${c.key}`) ?? []).join(", ")
      : displayAnswer({ type: c.type as FieldType, options: c.options ?? undefined }, r.answers[c.key] as AnswerValue)),
    r.incomplete ? "ใช่" : "", r.internalNote ?? "",
  ]);
  await db().query(`insert into audit_events (org_id, actor_user_id, action, entity_type, entity_id, after) values ($1,$2,'form.exported','form',$3,$4)`,
    [user.orgId, user.id, form.id, JSON.stringify({ format: sp.get("format"), rows: rows.length })]);
  const base = `${form.slug}-${new Date().toISOString().slice(0, 10)}`;
  if (sp.get("format") === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Responses");
    ws.addRow(header).font = { bold: true };
    // Spreadsheet formula injection guard: never let an answer become a formula.
    for (const row of data) ws.addRow(row.map((v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v)));
    ws.columns.forEach((c) => { c.width = 22; });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const buf = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buf as ArrayBuffer), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`, "Cache-Control": "no-store" } });
  }
  const csv = "﻿" + [header, ...data].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"`, "Cache-Control": "no-store" } });
}
