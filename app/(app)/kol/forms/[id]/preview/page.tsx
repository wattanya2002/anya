import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Monitor, Pencil, Smartphone } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { getForm, versionSchema } from "@/lib/forms-server";
import { currentTerms } from "@/lib/kol";
import { PublicForm } from "@/components/kol/public-form";
import "@/components/kol/public-form.css";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Preview Mobile / Desktop of the draft or the published version. Uses the real public form component; submit saves nothing. */
export default async function PreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const user = await requireUser();
  if (!can(user, "forms.manage") && !can(user, "forms.responses")) notFound();
  const { id } = await params;
  const sp = await searchParams;
  const form = await getForm(user.orgId, id);
  if (!form) notFound();
  const device = one(sp.device) === "desktop" ? "desktop" : "mobile";
  const src = one(sp.src) === "published" && form.currentVersionId ? "published" : "draft";
  const schema = src === "published" && form.currentVersionId ? (await versionSchema(form.currentVersionId))!.schema : form.draft;
  const terms = form.purpose !== "general" && form.campaignId ? await currentTerms(form.campaignId) : null;
  const q = (d: string, s: string) => `/kol/forms/${form.id}/preview?device=${d}&src=${s}`;
  return (
    <>
      <div className="k-row between">
        <Link href="/kol/forms" className="k-back"><ArrowLeft aria-hidden="true" />Form Dashboard</Link>
        {can(user, "forms.manage") && <Link href={`/kol/forms/${form.id}/edit`} className="k-btn sm soft"><Pencil aria-hidden="true" />แก้ไขฟอร์ม</Link>}
      </div>
      <h1 style={{ margin: "6px 0 0", fontSize: 19 }}>ตัวอย่าง: {form.title}</h1>
      <div className="k-row" style={{ marginTop: 10 }}>
        <nav className="pv-switch" aria-label="ขนาดหน้าจอ">
          <Link href={q("mobile", src)} className="k-chip" aria-current={device === "mobile" ? "true" : undefined}><Smartphone aria-hidden="true" style={{ width: 16, height: 16 }} />Mobile</Link>
          <Link href={q("desktop", src)} className="k-chip" aria-current={device === "desktop" ? "true" : undefined}><Monitor aria-hidden="true" style={{ width: 16, height: 16 }} />Desktop</Link>
        </nav>
        <nav className="pv-switch" aria-label="เวอร์ชัน">
          <Link href={q(device, "draft")} className="k-chip" aria-current={src === "draft" ? "true" : undefined}>ร่างล่าสุด</Link>
          {form.currentVersionId && <Link href={q(device, "published")} className="k-chip" aria-current={src === "published" ? "true" : undefined}>เผยแพร่ v{form.versionNo}</Link>}
        </nav>
      </div>
      <div className="pv-stage">
        <div className="pv-frame" data-device={device}>
          <PublicForm key={`${device}-${src}`} mode="preview" formId={form.id} slug={form.slug} versionId={form.currentVersionId ?? "preview"} title={form.title} schema={schema}
            terms={terms ? { id: terms.id, versionNo: terms.versionNo, title: terms.title, items: terms.items } : null} stamp=""
            heroUrl={schema.settings.heroFileId ? `/api/public/hero/${schema.settings.heroFileId}` : null}
            greeting={form.purpose === "kol_registration" ? "สวัสดีคุณ (ชื่อผู้สมัคร) ยินดีด้วยที่ผ่านการคัดเลือก" : undefined} />
        </div>
      </div>
    </>
  );
}
