import type { Metadata } from "next";
import { LinkIcon, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { prefillAnswers, allFields } from "@/lib/forms-core";
import { currentTerms } from "@/lib/kol";
import { registrationFormFor, resolveToken } from "@/lib/kol-intake";
import { TRANSITIONS } from "@/lib/kol-core";
import { PublicForm } from "@/components/kol/public-form";
import { startStamp } from "@/app/(public)/actions";

export const metadata: Metadata = { title: "ลงทะเบียน KOL · Wonder Courts", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** STEP 2 — only reachable with the private, expiring link issued after CEO approval. The application id is never in the URL. */
export default async function RegistrationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const who = await resolveToken(token, "registration");
  if (!who) return <Message icon={<LinkIcon aria-hidden="true" />} title="ลิงก์นี้ใช้ไม่ได้" body="ลิงก์หมดอายุ ถูกยกเลิก หรือไม่ถูกต้อง กรุณาติดต่อทีมงานทาง LINE @wondercourts เพื่อขอลิงก์ใหม่" />;
  if (!TRANSITIONS.register.from.includes(who.status as never)) {
    return <Message icon={<ShieldAlert aria-hidden="true" />} title="ยังกรอกข้อมูลขั้นนี้ไม่ได้" body="ใบสมัครนี้ยังไม่ได้รับสิทธิ์กรอกข้อมูลขั้นที่ 2 กรุณาติดต่อทีมงาน" />;
  }
  const form = await registrationFormFor(who.orgId);
  if (!form || form.status !== "published") return <Message icon={<ShieldAlert aria-hidden="true" />} title="แบบฟอร์มปิดอยู่ชั่วคราว" body="กรุณาติดต่อทีมงานทาง LINE @wondercourts" />;
  const social = (await db().query(`select platform, url, followers from kol_social_accounts where applicant_id = $1`, [who.applicantId])).rows;
  const initial = prefillAnswers(form.schema, {
    fullName: who.fullName, creatorName: who.creatorName, phone: who.phone, lineId: who.lineId, email: who.email,
    social: Object.fromEntries(social.map((s) => [s.platform, { url: s.url, followers: s.followers }])),
  });
  const terms = await currentTerms(who.campaignId);
  const already = who.status === "registered";
  return (
      <PublicForm mode="registration" formId={form.formId} slug={form.slug} versionId={form.versionId} title={form.title} schema={form.schema} token={token}
        terms={terms ? { id: terms.id, versionNo: terms.versionNo, title: terms.title, items: terms.items } : null} stamp={await startStamp()}
        initial={initial} prefilledKeys={allFields(form.schema).filter((f) => initial[f.key] !== undefined).map((f) => f.key)}
        heroUrl={form.schema.settings.heroFileId ? `/api/public/hero/${form.schema.settings.heroFileId}` : null}
        greeting={already ? `คุณ${who.creatorName} ส่งข้อมูลแล้ว — ส่งอีกครั้งเพื่อแก้ไขข้อมูลได้จนถึงวันที่ลิงก์หมดอายุ` : `สวัสดีคุณ${who.creatorName} ยินดีด้วยที่ผ่านการคัดเลือก`} />
  );
}

function Message({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="pf-root">
      <div className="pf-wrap">
        <span className="pf-brand"><span className="pf-ball" aria-hidden="true" />Wonder Courts</span>
        <div className="pf-closed">{icon}<h1>{title}</h1><p>{body}</p></div>
      </div>
    </div>
  );
}
