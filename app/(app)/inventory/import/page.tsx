import Link from "next/link";
import { Download, FileSpreadsheet, ListChecks } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatThaiDateTime } from "@/lib/format";
import { UploadForm, ConfirmForm } from "@/components/inventory/import-forms";
import { cancelImport } from "../actions";
import { TEMPLATE_COLUMNS, type ImportRow } from "@/lib/inventory-import";

export const dynamic = "force-dynamic";
const STATUS_TH: Record<string, string> = { validating: "รอยืนยัน", completed: "นำเข้าแล้ว", rolled_back: "ยกเลิก", failed: "ล้มเหลว", pending: "รอ" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const manage = can(user, "inventory.manage");
  const job = sp.job && /^[0-9a-f-]{36}$/i.test(sp.job)
    ? (await db().query(`select id, file_name, status, row_count, error_count, created_at from import_jobs where id = $1 and org_id = $2 and kind = 'products'`, [sp.job, user.orgId])).rows[0]
    : null;
  const rows = job ? (await db().query(`select row_no, data, errors from import_rows where import_job_id = $1 order by row_no`, [job.id])).rows as { row_no: number; data: ImportRow; errors: string[] }[] : [];
  const history = (await db().query(`select id, file_name, status, row_count, error_count, created_at from import_jobs where org_id = $1 and kind = 'products' order by created_at desc limit 10`, [user.orgId])).rows;
  const valid = rows.filter((r) => r.errors.length === 0).length;
  const done = job?.status === "completed"
    ? ((await db().query(`select after from audit_events where org_id = $1 and action = 'import.products_confirmed' and entity_id = $2 order by id desc limit 1`, [user.orgId, job.id])).rows[0]?.after as { created: number; updated: number; received: number } | undefined)
    : undefined;

  return (
    <div className="inv-body inv-split has-panel panel-left">
      <article className="card panel side-panel" aria-labelledby="up-title">
        <div className="panel-head">
          <span className="badge-icon tone-blue" aria-hidden="true"><FileSpreadsheet /></span>
          <div className="panel-head-text"><h2 className="panel-title" id="up-title">อัปโหลดรายการสินค้า</h2><p className="panel-sub">เพิ่มสินค้าใหม่ / อัปเดตตาม SKU / รับเข้าสต็อก</p></div>
        </div>
        <div className="card-body">
          <a className="btn-pill" href="/inventory/import/template" download><Download aria-hidden="true" />ดาวน์โหลดไฟล์แม่แบบ (.xlsx)</a>
          <ol className="steps">
            <li>กรอกข้อมูลในแม่แบบ หนึ่งแถวต่อหนึ่งสินค้า — ต้องมี <b>รหัสสินค้า (SKU)</b> และ <b>ชื่อสินค้า</b></li>
            <li>SKU ที่มีอยู่แล้ว = อัปเดตข้อมูล · SKU ใหม่ = เพิ่มสินค้า</li>
            <li>ถ้ากรอก “จำนวนรับเข้า” ระบบบันทึกรับเข้าที่ “ที่เก็บ” (เว้นว่าง = คลังสินค้า)</li>
            <li>ระบบแสดงตัวอย่างและข้อผิดพลาดก่อน ข้อมูลยังไม่ถูกบันทึกจนกว่าจะกดยืนยัน</li>
          </ol>
          {manage ? <UploadForm /> : <p className="muted">บทบาทของคุณดูข้อมูลได้อย่างเดียว</p>}
          <h3 className="mini-title">คอลัมน์ที่รองรับ</h3>
          <p className="muted small">{TEMPLATE_COLUMNS.map(([, th]) => th).join(" · ")}</p>
        </div>
      </article>

      <article className="card panel" aria-labelledby="pv-title">
        <div className="panel-head">
          <span className="badge-icon tone-purple" aria-hidden="true"><ListChecks /></span>
          <div className="panel-head-text">
            <h2 className="panel-title" id="pv-title">{job ? `ตรวจข้อมูล: ${job.file_name}` : "ประวัติการนำเข้า"}</h2>
            {job && <p className="panel-sub">{job.row_count} แถว · ถูกต้อง {valid} · มีข้อผิดพลาด {job.row_count - valid} · สถานะ {STATUS_TH[job.status] ?? job.status}</p>}
          </div>
          {job && <Link className="link-btn small" href="/inventory/import">ปิด</Link>}
        </div>
        {job && job.status === "validating" && manage && (
          <div className="confirm-bar">
            <ConfirmForm jobId={job.id} validCount={valid} />
            <form action={cancelImport}><input type="hidden" name="jobId" value={job.id} /><button className="btn-pill" type="submit">ยกเลิกไฟล์นี้</button></form>
            {valid < rows.length && <span className="muted small">แถวที่มีข้อผิดพลาดจะถูกข้าม แก้ไฟล์แล้วอัปโหลดใหม่ได้</span>}
          </div>
        )}
        {job && job.status === "completed" && (
          <div className="confirm-bar">
            <p className="form-msg ok" role="status">นำเข้าเรียบร้อยแล้ว: เพิ่มใหม่ {done?.created ?? 0} · อัปเดต {done?.updated ?? 0} · รับเข้าสต็อก {done?.received ?? 0} รายการ</p>
            <Link className="btn-pill" href="/inventory/products">ดูรายการสินค้า</Link>
          </div>
        )}
        <div className="card-body">
          {job ? (
            <table className="tbl">
              <thead><tr><th scope="col">แถว</th><th scope="col">SKU / ชื่อ</th><th scope="col">ประเภท / ยี่ห้อ</th><th scope="col" className="num">รับเข้า</th><th scope="col">ผลตรวจ</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.row_no} className={r.errors.length ? "row-error" : ""}>
                    <td data-label="แถว">{r.row_no}</td>
                    <th scope="row"><span className="cell-title">{r.data.name || "—"}</span><span className="cell-sub">{r.data.sku}</span></th>
                    <td data-label="ประเภท / ยี่ห้อ">{[r.data.category, r.data.brand].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="num" data-label="รับเข้า">{r.data.receiveQty ?? "—"}{r.data.receiveQty ? ` → ${r.data.location ?? "คลังสินค้า"}` : ""}</td>
                    <td data-label="ผลตรวจ">{r.errors.length ? <span className="err-text">{r.errors.join(" · ")}</span> : <span className="ok-text">พร้อมนำเข้า</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : history.length === 0 ? <div className="empty-state"><strong>ยังไม่เคยนำเข้าไฟล์</strong></div> : (
            <ul className="rows">
              {history.map((h) => (
                <li key={h.id} className="row">
                  <div className="row-main"><Link className="row-title" href={`/inventory/import?job=${h.id}`}>{h.file_name}</Link>
                    <span className="row-sub">{formatThaiDateTime(new Date(h.created_at))} · {h.row_count} แถว · ผิดพลาด {h.error_count}</span></div>
                  <span className="stock-badge ok">{STATUS_TH[h.status] ?? h.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    </div>
  );
}
