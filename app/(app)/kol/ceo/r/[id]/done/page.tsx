import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, MessageSquareMore, X } from "lucide-react";
import { can } from "@/lib/auth";
import { db } from "@/lib/db";
import { ceoQueueIds } from "@/lib/kol-ceo";
import { DECISION_LABEL } from "@/lib/kol-core";
import { KolHead, StatusBadge, Note } from "@/components/kol/ui";
import { CeoStrip, ceoHref, when } from "@/components/kol/ceo-ui";
import { RevealCopy } from "@/components/kol/client";
import { loadCeo, type CeoParams } from "../load";

const TITLE: Record<string, string> = { approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติแล้ว", info_requested: "ส่งคำขอข้อมูลเพิ่มแล้ว" };

/** Decision success (Master RCM 15): the saved result and the applicant's new status, read back from the database. */
export default async function CeoDone(p: CeoParams) {
  const { user, ctx } = await loadCeo(p, ceoHref.done);
  const c = ctx.card, a = c.applicant, tab = ctx.tab;
  if (c.requestStatus === "pending" || !c.decision) redirect(ceoHref.card(c.requestId, tab));
  const d = c.decision!;
  const [next, link] = await Promise.all([
    ceoQueueIds(user.orgId, "pending").then((ids) => ids.find((x) => x !== c.requestId) ?? null),
    d.decision === "approved" && can(user, "kol.review")
      ? db().query(`select id, expires_at from kol_access_tokens where applicant_id = $1 and purpose = 'registration' and revoked_at is null and expires_at > now() order by created_at desc limit 1`, [a.id]).then((r) => r.rows[0] ?? null)
      : Promise.resolve(null),
  ]);
  return (
    <>
      <KolHead user={user} title="CEO Approval" sub="ผลการพิจารณา" back={ceoHref.queue("pending")} />
      <div style={{ marginTop: 22 }}><CeoStrip name={a.creatorName} refNo={a.refNo} photoFileId={a.photoFileId} social={a.social} /></div>
      <section className="k-dc k-done" style={{ marginTop: 22 }} aria-labelledby="done-h" role="status">
        <div className={`k-dc-ic ${d.decision === "approved" ? "ok" : d.decision === "rejected" ? "x" : "ask"}`} aria-hidden="true">
          {d.decision === "approved" ? <Check /> : d.decision === "rejected" ? <X /> : <MessageSquareMore />}
        </div>
        <h2 id="done-h">{TITLE[d.decision] ?? DECISION_LABEL[d.decision]}</h2>
        <p className="k-dc-sub">{a.creatorName} · บันทึกโดย {d.byName} · {when(d.at)}</p>
        {d.note && <p className="k-dc-note" style={{ textAlign: "left" }}><b>{d.decision === "approved" ? "หมายเหตุ:" : d.decision === "rejected" ? "เหตุผล:" : "ข้อมูลที่ขอ:"}</b> {d.note}</p>}
        <div className="k-status-new"><span className="k-muted">สถานะใหม่</span><StatusBadge status={a.status} /></div>

        {d.decision === "approved" && (
          <div style={{ marginTop: 16, textAlign: "left" }}>
            {link
              ? <><p className="k-label" style={{ margin: 0 }}>ลิงก์ STEP 2 สำหรับ {a.creatorName} — คัดลอกไปส่งทาง LINE (ระบบไม่ได้ส่งเอง)</p>
                  <RevealCopy tokenId={link.id} purpose="registration" name={a.creatorName} expiresAt={new Date(link.expires_at).toISOString()} /></>
              : <Note>ระบบสร้างลิงก์ STEP 2 แล้ว — Marketing คัดลอกไปส่งให้ KOL ทาง LINE จากหน้าผู้สมัคร (ระบบไม่ได้ส่ง LINE เอง)</Note>}
          </div>
        )}
        {d.decision === "info_requested" && <div style={{ marginTop: 22, textAlign: "left" }}><Note tone="warn">Marketing จะเห็นคำขอนี้ในหน้าผู้สมัคร และเสนอการ์ดใหม่เมื่อได้ข้อมูลครบ</Note></div>}

        <div className="k-dc-acts">
          <Link href={ceoHref.queue("pending")} className="k-btn cancel outline">กลับคิว</Link>
          {next
            ? <Link href={ceoHref.card(next, "pending")} className="k-btn primary">ดูคนถัดไป</Link>
            : <span className="k-btn" aria-disabled="true">ไม่มีคนถัดไป</span>}
        </div>
      </section>
    </>
  );
}
