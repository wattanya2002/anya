import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { CopyPlus, Eye, FilePlus2, FileText, ListChecks, Lock, Pencil } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { listForms } from "@/lib/forms-server";
import { ceoCounts, kolReady } from "@/lib/kol";
import { PURPOSE_LABEL } from "@/lib/forms-core";
import { KolHead, fmtDateTime, Empty } from "@/components/kol/ui";
import { ActionForm, CopyButton } from "@/components/kol/client";
import { createForm, duplicateForm, setFormStatus } from "../actions";

const STATUS = { draft: { label: "Draft", tone: "gray" }, published: { label: "Published", tone: "green" }, closed: { label: "Closed", tone: "red" } } as const;

/** Form Dashboard (Module B): every form of the organization, managed without touching source code. */
export default async function FormsDashboard() {
  const user = await requireUser();
  const manage = can(user, "forms.manage");
  if (!manage && !can(user, "forms.responses")) notFound();
  await kolReady(user);
  const [forms, ceo] = await Promise.all([listForms(user.orgId), can(user, "kol.view") ? ceoCounts(user.orgId) : null]);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return (
    <>
      <KolHead user={user} active="forms" title="Form Builder" sub="สร้าง แก้ไข เผยแพร่ และดูคำตอบ — ไม่ต้องแก้ Source Code" pending={ceo?.pending} />
      {manage && (
        <details className="k-card" style={{ marginTop: 14 }}>
          <summary className="k-btn primary" style={{ listStyle: "none", width: "fit-content" }}><FilePlus2 aria-hidden="true" />สร้างฟอร์มใหม่</summary>
          <ActionForm action={createForm} submitLabel="สร้างและเริ่มแก้ไข">
            <label className="k-field" style={{ marginTop: 12 }}><span className="k-label">ชื่อฟอร์ม</span>
              <input className="k-input" name="title" maxLength={160} required placeholder="เช่น แบบประเมินหลังร่วมแคมเปญ" /></label>
            <p className="k-hint">ฟอร์มใหม่เป็นฟอร์มทั่วไป (เก็บคำตอบ ดู และส่งออกได้) ส่วนฟอร์มใบสมัคร KOL และ STEP 2 ผูกกับ Workflow อยู่แล้ว</p>
          </ActionForm>
        </details>
      )}
      {forms.length === 0 ? <div className="k-card" style={{ marginTop: 14 }}><Empty title="ยังไม่มีฟอร์ม" /></div> : (
        <ul className="k-forms">
          {forms.map((f) => {
            const st = STATUS[f.status];
            const url = `${proto}://${host}/f/${f.slug}`;
            return (
              <li key={f.id} className="k-card k-form-card">
                <h3>{f.title}<span className="k-badge" data-tone={st.tone}>{st.label}</span><span className="k-tag">{PURPOSE_LABEL[f.purpose]}</span>
                  {f.status !== "draft" && f.draftDirty && <span className="k-badge nodot" data-tone="amber">มีการแก้ไขที่ยังไม่เผยแพร่</span>}</h3>
                <div className="k-form-meta">
                  <span>{f.versionNo ? `เวอร์ชันที่เผยแพร่ v${f.versionNo}` : "ยังไม่เคยเผยแพร่"}</span>
                  <span>ผู้ตอบ <b>{f.responses.toLocaleString("en-US")}</b> ราย</span>
                  <span>อัปเดตล่าสุด {fmtDateTime(f.updatedAt)}</span>
                  {f.lastResponseAt && <span>คำตอบล่าสุด {fmtDateTime(f.lastResponseAt)}</span>}
                </div>
                <div className="k-actions">
                  {manage && <Link href={`/kol/forms/${f.id}/edit`} className="k-btn sm soft"><Pencil aria-hidden="true" />Edit</Link>}
                  <Link href={`/kol/forms/${f.id}/preview`} className="k-btn sm soft"><Eye aria-hidden="true" />Preview</Link>
                  {f.purpose === "kol_registration"
                    ? <span className="k-btn sm" aria-disabled="true" title="ลิงก์ STEP 2 ออกให้เฉพาะผู้ที่ CEO อนุมัติ จากหน้าผู้สมัคร"><Lock aria-hidden="true" />ลิงก์เฉพาะผู้ผ่านอนุมัติ</span>
                    : f.status !== "draft" && <CopyButton text={url} label="Copy Link" />}
                  {can(user, "forms.responses") && <Link href={`/kol/forms/${f.id}/responses`} className="k-btn sm primary"><ListChecks aria-hidden="true" />View Responses</Link>}
                  {manage && f.purpose === "general" && (
                    <ActionForm action={duplicateForm} submitLabel={<><CopyPlus aria-hidden="true" />Duplicate</>} submitClass="k-btn sm" inline><input type="hidden" name="form_id" value={f.id} /></ActionForm>
                  )}
                  {manage && f.purpose !== "general" && (
                    <ActionForm action={duplicateForm} submitLabel={<><CopyPlus aria-hidden="true" />Duplicate</>} submitClass="k-btn sm" inline
                      confirm={{ title: "ทำสำเนาฟอร์มนี้?", body: "สำเนาจะเป็นฟอร์มทั่วไป ไม่ผูกกับ Workflow ใบสมัคร KOL / STEP 2", confirmLabel: "ทำสำเนา" }} id={`dup-${f.id}`}>
                      <input type="hidden" name="form_id" value={f.id} />
                    </ActionForm>
                  )}
                  {manage && f.status === "published" && (
                    <ActionForm action={setFormStatus} submitLabel="Close Form" submitClass="k-btn sm danger" id={`close-${f.id}`} inline
                      confirm={{ title: `ปิดรับคำตอบ “${f.title}”?`, body: f.purpose === "kol_application" ? "ผู้ที่เปิดลิงก์สมัครจะเห็นข้อความว่าปิดรับสมัครแล้ว คำตอบเดิมยังอยู่ครบ" : "ผู้ที่เปิดลิงก์จะส่งคำตอบไม่ได้ คำตอบเดิมยังอยู่ครบ", confirmLabel: "ปิดรับ", tone: "danger" }}>
                      <input type="hidden" name="form_id" value={f.id} /><input type="hidden" name="status" value="closed" />
                    </ActionForm>
                  )}
                  {manage && f.status === "closed" && (
                    <ActionForm action={setFormStatus} submitLabel="เปิดรับอีกครั้ง" submitClass="k-btn sm green" inline>
                      <input type="hidden" name="form_id" value={f.id} /><input type="hidden" name="status" value="published" />
                    </ActionForm>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="k-muted k-small" style={{ margin: "14px 4px 0", display: "flex", gap: 6, alignItems: "center" }}><FileText aria-hidden="true" style={{ width: 15, height: 15 }} />แก้ไขฟอร์มที่เผยแพร่แล้วจะสร้างเวอร์ชันใหม่เมื่อกดเผยแพร่ คำตอบเก่ายังอ้างอิงคำถามเวอร์ชันเดิม</p>
    </>
  );
}
