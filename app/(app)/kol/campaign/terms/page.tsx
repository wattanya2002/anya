import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, Settings2 } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { kolReady, termsHistory } from "@/lib/kol";
import { ActionForm } from "@/components/kol/client";
import { Note, fmtDateTime } from "@/components/kol/ui";
import { saveCampaignTerms } from "../../actions";

/** Campaign Template: edits create a new terms version; joined KOL keep the version they accepted. */
export default async function TermsPage() {
  const user = await requireUser();
  if (!can(user, "kol.review")) notFound();
  await kolReady(user);
  const camp = (await db().query(`select c.id, c.name from kol_campaigns k join campaigns c on c.id = k.campaign_id where k.org_id = $1 and k.key = 'kol'`, [user.orgId])).rows[0];
  if (!camp) notFound();
  const hist = await termsHistory(camp.id);
  const t = hist[0];
  return (
    <>
      <Link href="/kol/campaign" className="k-back"><ArrowLeft aria-hidden="true" />Campaign Management</Link>
      <section className="k-card" style={{ marginTop: 8 }} aria-labelledby="t-h">
        <div className="k-card-h"><h1 id="t-h" style={{ margin: 0, fontSize: 19, display: "flex", gap: 8, alignItems: "center" }}><Settings2 aria-hidden="true" />Campaign Template · เวอร์ชัน {t.versionNo}</h1></div>
        <Note>การบันทึกจะสร้างเงื่อนไขเวอร์ชันใหม่ ฟอร์มสมัครแสดงเวอร์ชันล่าสุด ผู้สมัครและ KOL ที่ยืนยันไปแล้วยังใช้เวอร์ชันเดิม (Deliverables เดิมไม่เปลี่ยน) การแก้คำถามในฟอร์มไม่เปลี่ยนเงื่อนไขนี้</Note>
        <ActionForm action={saveCampaignTerms} submitLabel="บันทึกเป็นเวอร์ชันใหม่" id="terms"
          confirm={{ title: "บันทึกเงื่อนไขเวอร์ชันใหม่?", body: "ผู้สมัครรายใหม่จะเห็นและยืนยันเงื่อนไขชุดนี้ ผู้ที่ยืนยันไปแล้วไม่ได้รับผลกระทบ", confirmLabel: "บันทึก" }}>
          <input type="hidden" name="campaign_id" value={camp.id} />
          <div className="k-form-grid cols2" style={{ marginTop: 12 }}>
            <label className="k-field span2"><span className="k-label">ชื่อแคมเปญ / เงื่อนไข</span><input className="k-input" name="title" defaultValue={t.title} maxLength={160} /></label>
            <label className="k-field span2"><span className="k-label">เงื่อนไขที่แสดงในฟอร์ม (1 บรรทัดต่อ 1 ข้อ)</span><textarea className="k-textarea" name="items" rows={10} defaultValue={t.items.join("\n")} /></label>
            <label className="k-field span2"><span className="k-label">ผลงานที่ต้องส่ง / Deliverables (1 บรรทัดต่อ 1 รายการ)</span><textarea className="k-textarea" name="deliverables" rows={5} defaultValue={t.deliverables.map((d) => d.label).join("\n")} /></label>
            <label className="k-field"><span className="k-label">เครดิตคอร์ท (ชั่วโมง)</span><input className="k-input" name="credit_hours" inputMode="decimal" defaultValue={t.creditHours} /></label>
            <label className="k-field"><span className="k-label">มูลค่าเครดิต (บาท)</span><input className="k-input" name="credit_value" inputMode="numeric" defaultValue={t.creditValueSatang / 100} /></label>
            <label className="k-field"><span className="k-label">ส่วนลด Promo Code (%)</span><input className="k-input" name="promo_pct" inputMode="decimal" defaultValue={t.promoDiscountBps / 100} /></label>
            <label className="k-field"><span className="k-label">Promo Code ใช้ได้ (ครั้ง)</span><input className="k-input" name="promo_max_uses" inputMode="numeric" defaultValue={t.promoMaxUses ?? ""} /></label>
            <label className="k-field"><span className="k-label">Promo Code ใช้ได้ภายใน (วัน)</span><input className="k-input" name="promo_valid_days" inputMode="numeric" defaultValue={t.promoValidDays ?? ""} /></label>
            <label className="k-field"><span className="k-label">ผู้ติดตามขั้นต่ำ (อย่างน้อย 1 ช่องทาง)</span><input className="k-input" name="min_followers" inputMode="numeric" defaultValue={t.minFollowers} /></label>
            <label className="k-field"><span className="k-label">ส่งผลงานภายใน (วันหลังเข้าใช้บริการ)</span><input className="k-input" name="deliver_within_days" inputMode="numeric" defaultValue={t.deliverWithinDays ?? ""} /></label>
          </div>
        </ActionForm>
      </section>
      <section className="k-card" aria-labelledby="t-hist">
        <div className="k-card-h"><h2 id="t-hist"><History aria-hidden="true" />ประวัติเวอร์ชัน</h2></div>
        <ul className="k-timeline">
          {hist.map((h) => <li key={h.id}><div><b>เวอร์ชัน {h.versionNo}{h.isCurrent ? " (ใช้อยู่)" : ""}</b><br /><small>{fmtDateTime(h.createdAt)} · {h.items.length} ข้อ · ผลงาน {h.deliverables.length} รายการ</small></div></li>)}
        </ul>
      </section>
    </>
  );
}
