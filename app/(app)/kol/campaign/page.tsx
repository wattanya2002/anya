import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronRight, Settings2, Users } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { ceoCounts, currentTerms, kolReady, listParticipants } from "@/lib/kol";
import { applicantRef, creditSummary, deliverableProgress, VISIT_LABEL } from "@/lib/kol-core";
import { db } from "@/lib/db";
import { Avatar, Empty, KolHead, fmtDate, SourceNote } from "@/components/kol/ui";

export default async function CampaignList() {
  const user = await requireUser();
  if (!can(user, "kol.view")) notFound();
  await kolReady(user);
  const camp = (await db().query(`select c.id, c.name from kol_campaigns k join campaigns c on c.id = k.campaign_id where k.org_id = $1 and k.key = 'kol'`, [user.orgId])).rows[0];
  const [rows, terms, ceo] = await Promise.all([listParticipants(user.orgId), camp ? currentTerms(camp.id) : null, ceoCounts(user.orgId)]);
  const active = rows.filter((r) => r.status === "active");
  const allDeliv = rows.flatMap((r) => r.deliverables);
  const verified = allDeliv.filter((d) => d.status === "verified").length;
  const waiting = allDeliv.filter((d) => d.status === "submitted").length;
  return (
    <>
      <KolHead user={user} active="campaign" title="Campaign Management" sub="KOL ที่ผ่านคัดเลือกและยืนยันข้อมูลแล้ว" pending={ceo.pending} />
      <section className="k-card" style={{ marginTop: 14 }} aria-labelledby="c-sum">
        <div className="k-card-h">
          <h2 id="c-sum"><Users aria-hidden="true" />{camp?.name ?? "KOL Campaign"}</h2>
          {terms && can(user, "kol.review") && <Link href="/kol/campaign/terms" className="k-btn sm soft"><Settings2 aria-hidden="true" />เงื่อนไข v{terms.versionNo}</Link>}
        </div>
        <div className="k-metrics">
          <div className="k-stat"><b>{rows.length}</b><span>KOL ในแคมเปญ</span></div>
          <div className="k-stat"><b>{active.filter((r) => r.visitStatus === "visited").length}/{active.length}</b><span>มาใช้บริการแล้ว</span></div>
          <div className="k-stat"><b>{verified}/{allDeliv.length}</b><span>ผลงานตรวจแล้ว</span></div>
          <div className="k-stat"><b>{waiting}</b><span>ผลงานรอตรวจ</span></div>
        </div>
        <p style={{ margin: "10px 0 0" }}><SourceNote>นับจากข้อมูลที่ทีมบันทึกในระบบนี้ · ยังไม่เชื่อม API ของโซเชียลหรือระบบจอง</SourceNote></p>
      </section>

      {rows.length === 0 ? (
        <div className="k-card" style={{ marginTop: 14 }}><Empty title="ยังไม่มี KOL ในแคมเปญ" body="KOL จะเข้ามาที่นี่อัตโนมัติเมื่อ CEO อนุมัติและ KOL กรอก STEP 2 เรียบร้อย" /></div>
      ) : (
        <ul className="k-list">
          {rows.map((p) => {
            const prog = deliverableProgress(p.deliverables);
            const cr = creditSummary(p.credits);
            return (
              <li key={p.id} className="k-item">
                <Avatar name={p.creatorName} fileId={p.photoFileId} />
                <div style={{ minWidth: 0 }}>
                  <h3 className="k-ellipsis">{p.creatorName}</h3>
                  <div className="k-item-meta"><span>{applicantRef(p.refNo)}</span><span><CalendarDays aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: -2 }} /> {p.visitDate ? `${fmtDate(p.visitDate)}${p.visitTime ? ` ${p.visitTime}` : ""}` : "ยังไม่นัด"}</span>
                    <span className="k-tag">{VISIT_LABEL[p.visitStatus]}</span></div>
                </div>
                <div className="k-item-social">
                  <div className="k-row between k-small"><span>ผลงาน {prog.verified}/{prog.total} ตรวจแล้ว</span><span className="k-muted">เครดิตเหลือ {cr.remaining} ชม.</span></div>
                  <div className="k-progress" style={{ marginTop: 6 }} role="img" aria-label={`ผลงานตรวจแล้ว ${prog.verified} จาก ${prog.total}`}><i style={{ width: `${prog.total ? (prog.verified / prog.total) * 100 : 0}%` }} /></div>
                  {p.promos.filter((x) => x.status === "active").map((x) => <span key={x.id} className="k-tag" style={{ marginTop: 6, marginRight: 4 }}>{x.code}</span>)}
                </div>
                <div className="k-item-foot">
                  <span className="k-badge" data-tone={p.status === "completed" ? "green" : p.status === "cancelled" ? "gray" : "navy"}>{p.status === "completed" ? "จบแคมเปญ" : p.status === "cancelled" ? "ยกเลิก" : prog.done ? "ส่งผลงานครบ" : "กำลังดำเนินการ"}</span>
                  <Link href={`/kol/campaign/${p.id}`} className="k-btn sm soft">จัดการ<ChevronRight aria-hidden="true" /></Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
