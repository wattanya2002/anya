import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, BadgeCheck, ClipboardCheck, ExternalLink, History, Link2, ListChecks, Lock, MessageCircle, MessageSquareText, NotebookPen, Send, ShieldAlert, Star, UserRound } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { getApplicant, termsById } from "@/lib/kol";
import { applicantRef, canTransition, ceoCardMessage, DECISION_LABEL, STATUS_LABEL, infoRequestMessage, lineShareUrl, meetsFollowerRule, type ApplicantStatus } from "@/lib/kol-core";
import { KolHead, KolPhoto, SocialChips, SocialPair, StatusBadge, fmtDateTime, fmtDate, Note } from "@/components/kol/ui";
import { AnswersView } from "@/components/kol/answers";
import { ActionForm, ComposeBox, CopyButton, MessageOut, RevealCopy } from "@/components/kol/client";
import {
  addKolComment, addReviewNote, eraseApplicant, issueApplicantLink, rejectAtScreening, requestInfoFromApplicant, revokeApplicantLink, sendToCeo, shortlistApplicant,
} from "../../actions";

export default async function ApplicantPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "kol.view")) notFound();
  const { id } = await params;
  const a = await getApplicant(user.orgId, id);
  if (!a) notFound();
  const review = can(user, "kol.review");
  if (review && !a.firstViewedAt) await db().query(`update kol_applicants set first_viewed_at = now() where id = $1 and first_viewed_at is null`, [a.id]);
  const [terms, camps] = await Promise.all([
    termsById(a.termsId),
    db().query(`select c.id, c.name from kol_campaigns k join campaigns c on c.id = k.campaign_id where k.org_id = $1 order by c.created_at`, [user.orgId]),
  ]);
  const st = a.status as ApplicantStatus;
  const lastRound = a.approvals.at(-1);
  const activeLinks = a.tokens.filter((t) => !t.revokedAt && t.expiresAt > new Date());
  const regLink = activeLinks.find((t) => t.purpose === "registration");
  const statusLink = activeLinks.find((t) => t.purpose === "status");
  const minF = terms?.minFollowers ?? 0;
  const prev = a.reviews.filter((r) => r.kind === "note");
  const lastAsk = a.reviews.filter((r) => r.kind === "request_info").at(-1); // reviews are oldest first
  // Link to the pending CEO card, for Marketing to send the CEO (goes through sign-in and back to the card).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const ceoUrl = st === "pending_ceo" && lastRound?.status === "pending" && host ? `${proto}://${host}/kol/ceo/card/${lastRound.id}` : null;
  const ceoMsg = ceoUrl && lastRound ? ceoCardMessage({ ref: applicantRef(a.refNo), name: a.creatorName, pitch: lastRound.shortPitch, url: ceoUrl }) : "";

  return (
    <>
      <KolHead user={user} title="รายละเอียดผู้สมัคร" sub={`${applicantRef(a.refNo)} · สมัคร ${fmtDateTime(a.createdAt)}`} back="/kol"
        right={can(user, "kol.decide") && lastRound?.status === "pending" ? <Link href={`/kol/ceo/r/${lastRound.id}`} className="k-btn sm primary"><ClipboardCheck aria-hidden="true" />เปิดการ์ด CEO</Link> : undefined} />

      <section className="k-strip" style={{ marginTop: 22, alignItems: "flex-start" }} aria-labelledby="ap-name">
        <KolPhoto name={a.creatorName} fileId={a.photoFileId} large />
        <div style={{ minWidth: 0 }}>
          <h2 id="ap-name" className="k-app-name"><b style={{ fontSize: 26 }}>{a.creatorName}</b><span className="k-code">{applicantRef(a.refNo)}</span></h2>
          <p className="k-muted" style={{ margin: "4px 0 0", fontSize: 14 }}>{a.fullName}</p>
          <div className="k-row" style={{ marginTop: 10 }}>
            <StatusBadge status={st} />
            {a.rejectedStage && <span className="k-tag">ไม่ผ่านขั้น{a.rejectedStage === "ceo" ? " CEO" : "คัดกรอง"}</span>}
            {minF > 0 && (meetsFollowerRule(a.social, minF)
              ? <span className="k-badge nodot" data-tone="green">Followers ถึงเกณฑ์ {minF.toLocaleString("en-US")}</span>
              : <span className="k-badge nodot" data-tone="amber">Followers ต่ำกว่าเกณฑ์ {minF.toLocaleString("en-US")}</span>)}
          </div>
          <SocialPair social={a.social} />
        </div>
      </section>
      {a.erasedAt && <div style={{ marginTop: 18 }}><Note tone="warn">ข้อมูลส่วนบุคคลถูกลบเมื่อ {fmtDateTime(a.erasedAt)} — เหลือเฉพาะสถิติและประวัติการดำเนินการ</Note></div>}

      <div className="k-grid two">
        <div className="k-stack">
          <section className="k-card" aria-labelledby="h-profile">
            <div className="k-card-h"><h2 id="h-profile"><UserRound aria-hidden="true" />ข้อมูลผู้สมัคร</h2></div>
            <dl className="k-kv">
              <div><dt>เบอร์โทรศัพท์</dt><dd>{a.phone ? <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`}>{a.phone}</a> : "–"}</dd></div>
              <div><dt>LINE ID</dt><dd>{a.lineId ?? "–"}</dd></div>
              {a.email && <div><dt>อีเมล</dt><dd>{a.email}</dd></div>}
              <div><dt>ประเภทคอนเทนต์</dt><dd>{a.categories.join(", ") || "–"}</dd></div>
              <div><dt>ประสบการณ์เทนนิส</dt><dd>{a.tennisExperience ?? "–"}</dd></div>
              {a.bio && <div><dt>แนะนำตัว</dt><dd>{a.bio}</dd></div>}
              {a.motivation && <div><dt>เหตุผลที่สนใจ</dt><dd>{a.motivation}</dd></div>}
              <div><dt>รับทราบเงื่อนไข</dt><dd>{a.termsAcceptedAt ? `${fmtDateTime(a.termsAcceptedAt)}${terms ? ` · เวอร์ชัน ${terms.versionNo}` : ""}` : "–"}</dd></div>
            </dl>
          </section>

          <section className="k-card" aria-labelledby="h-social">
            <div className="k-card-h"><h2 id="h-social"><Star aria-hidden="true" />Social Media & ผลงาน</h2></div>
            <SocialChips social={a.social} />
            {a.sampleLinks.length > 0 && (
              <ul className="k-files" style={{ marginTop: 18 }}>
                {a.sampleLinks.map((l) => <li key={l}><a href={l} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" /><span className="k-ellipsis">{l}</span></a></li>)}
              </ul>
            )}
          </section>

          <section className="k-card" aria-labelledby="h-answers">
            <div className="k-card-h"><h2 id="h-answers"><ListChecks aria-hidden="true" />คำตอบฟอร์มทั้งหมด</h2><span className="k-tag">ฟอร์ม v{a.submission.versionNo}</span></div>
            <AnswersView schema={a.submission.schema} answers={a.submission.answers} files={a.submission.files} />
          </section>

          {a.registration && (
            <section className="k-card" aria-labelledby="h-reg">
              <div className="k-card-h"><h2 id="h-reg"><BadgeCheck aria-hidden="true" />ข้อมูล STEP 2 (ยืนยันแล้ว)</h2>
                {a.participantId && <Link className="k-btn sm soft" href={`/kol/campaign/${a.participantId}`}>Campaign Tracking</Link>}</div>
              <p className="k-sub">ส่งเมื่อ {fmtDateTime(a.registration.submittedAt)}{a.registration.updatedAt > a.registration.submittedAt ? ` · แก้ไขล่าสุด ${fmtDateTime(a.registration.updatedAt)}` : ""}</p>
              <AnswersView schema={a.registration.submission.schema} answers={a.registration.submission.answers} files={a.registration.submission.files} />
            </section>
          )}

          {a.approvals.length > 0 && (
            <section className="k-card" aria-labelledby="h-ceo">
              <div className="k-card-h"><h2 id="h-ceo"><ClipboardCheck aria-hidden="true" />การพิจารณาของ CEO</h2></div>
              <ul className="k-timeline">
                {a.approvals.slice().reverse().map((r) => (
                  <li key={r.id}><div>
                    <b>รอบที่ {r.roundNo} · {DECISION_LABEL[r.status]}</b> <small>เสนอโดย {r.submittedByName} {fmtDateTime(r.submittedAt)}</small>
                    <p style={{ margin: "4px 0 0" }}>{r.shortPitch}</p>
                    {r.decision && <p style={{ margin: "4px 0 0" }}><b>{r.decision.byName}</b> {DECISION_LABEL[r.decision.decision]} · {fmtDateTime(r.decision.at)}{r.decision.note ? ` — ${r.decision.note}` : ""}</p>}
                  </div></li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="k-stack">
          {review && !a.erasedAt && (
            <section className="k-card" aria-labelledby="h-act">
              <div className="k-card-h"><h2 id="h-act"><Send aria-hidden="true" />การดำเนินการ</h2></div>
              {st === "shortlisted" && <Note tone="ok">ย้ายเข้ารายชื่อผ่านการคัดกรองแล้ว — กรอกข้อมูลด้านล่างเพื่อเสนอ CEO พิจารณา</Note>}
              {st === "pending_ceo" && <Note>ส่งการ์ดให้ CEO แล้ว · รอ CEO พิจารณา — Marketing เพิ่มความคิดเห็นได้ แต่เปลี่ยนผลการอนุมัติไม่ได้</Note>}
              {ceoUrl && (
                <div style={{ marginTop: 10 }} id="ceo-link">
                  <span className="k-label">ลิงก์การ์ด CEO — ส่งให้ CEO เปิดดูและตัดสินใจ (ถ้ายังไม่ได้เข้าสู่ระบบ จะให้เข้าสู่ระบบก่อน แล้วกลับมาที่การ์ดนี้)</span>
                  <div className="k-msgbox">{ceoUrl}</div>
                  <div className="k-actions" style={{ marginTop: 8 }}>
                    <CopyButton text={ceoUrl} label="คัดลอกลิงก์" />
                    <CopyButton text={ceoMsg} label="คัดลอกข้อความ" className="k-btn sm ghost" />
                    <a className="k-btn sm sky" href={lineShareUrl(ceoMsg)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />เปิด LINE เพื่อส่งเอง</a>
                  </div>
                  <p className="k-hint">ระบบยังไม่ส่ง LINE ให้อัตโนมัติ — คัดลอกไปส่งเอง</p>
                </div>
              )}
              {st === "ceo_info_requested" && lastRound?.decision?.note && <Note tone="warn"><b>CEO ขอข้อมูลเพิ่ม:</b> {lastRound.decision.note}</Note>}
              {st === "info_requested" && <Note tone="warn">รอผู้สมัครส่งข้อมูลเพิ่ม — เมื่อได้รับแล้วกดผ่านการคัดกรองหรือเสนอ CEO ได้เลย</Note>}
              {st === "info_requested" && lastAsk?.body && (
                <div style={{ marginTop: 10 }}>
                  <span className="k-label">ข้อความขอข้อมูลเพิ่ม (คัดลอกไปส่งทาง LINE — ระบบไม่ได้ส่งเอง)</span>
                  <MessageOut text={infoRequestMessage({ name: a.creatorName, ref: applicantRef(a.refNo), reason: lastAsk.body })} />
                </div>
              )}
              {(st === "approved" || st === "registered") && <Note tone="ok">CEO อนุมัติแล้ว{st === "approved" ? " — ส่งลิงก์ STEP 2 ให้ KOL ทาง LINE" : " และ KOL ยืนยันข้อมูลแล้ว"}</Note>}
              {st === "rejected" && <Note tone="err">ไม่ผ่าน{a.rejectedStage === "ceo" ? "การพิจารณาของ CEO" : "การคัดกรอง"} — เปลี่ยนผลจากหน้านี้ไม่ได้</Note>}

              {canTransition("shortlist", st) && (
                <ActionForm action={shortlistApplicant} submitLabel={<><Star aria-hidden="true" />ผ่านการคัดกรอง (Shortlist)</>} submitClass="k-btn soft block">
                  <input type="hidden" name="applicant_id" value={a.id} />
                </ActionForm>
              )}

              {canTransition("send_to_ceo", st) && (
                <details style={{ marginTop: 18 }} open={st === "shortlisted" || st === "ceo_info_requested"}>
                  <summary className="k-btn primary block" style={{ listStyle: "none" }}><Send aria-hidden="true" />เสนอ CEO พิจารณา</summary>
                  <ActionForm action={sendToCeo} submitLabel={<><Send aria-hidden="true" />ส่งการ์ดให้ CEO</>} className="k-stack" id="send-ceo">
                    <input type="hidden" name="applicant_id" value={a.id} />
                    <div style={{ marginTop: 18 }}>
                      <label className="k-field"><span className="k-label">ข้อเสนอสั้น ๆ บนการ์ด *</span>
                        <input className="k-input" name="short_pitch" maxLength={200} required placeholder="เช่น สายฟิตเนส 12K บน IG เหมาะกับคอนเทนต์เทนนิสมือใหม่" /></label>
                      <label className="k-field"><span className="k-label">ความเห็น Marketing *</span><textarea className="k-textarea" name="opinion" maxLength={2000} required /></label>
                      <label className="k-field"><span className="k-label">เหตุผลที่เสนอ</span><textarea className="k-textarea" name="reason" maxLength={2000} /></label>
                      <label className="k-field"><span className="k-label">จุดเด่นของ KOL</span><textarea className="k-textarea" name="highlights" maxLength={2000} /></label>
                      <label className="k-field"><span className="k-label">สิ่งที่ควรระวัง</span><textarea className="k-textarea" name="cautions" maxLength={2000} /></label>
                      <label className="k-field"><span className="k-label">Campaign ที่ต้องการให้เข้าร่วม *</span>
                        <select className="k-select" name="campaign_id" defaultValue={a.campaignId}>{camps.rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                    </div>
                  </ActionForm>
                </details>
              )}

              {canTransition("request_info", st) && (
                <details style={{ marginTop: 18 }}>
                  <summary className="k-btn amber block" style={{ listStyle: "none" }}><MessageSquareText aria-hidden="true" />ขอข้อมูลเพิ่มจากผู้สมัคร</summary>
                  <ActionForm action={requestInfoFromApplicant} submitLabel="บันทึกคำขอและสร้างข้อความ" submitClass="k-btn amber">
                    <input type="hidden" name="applicant_id" value={a.id} />
                    <label className="k-field" style={{ marginTop: 18 }}><span className="k-label">ต้องการข้อมูลอะไรเพิ่ม *</span>
                      <textarea className="k-textarea" name="reason" maxLength={2000} required placeholder="เช่น ขอลิงก์คลิปรีวิวสินค้าที่เคยทำ 1–2 ลิงก์" /></label>
                    <p className="k-hint">ระบบยังไม่เชื่อม LINE Messaging API — จะสร้างข้อความให้คัดลอกไปส่งเอง</p>
                  </ActionForm>
                </details>
              )}

              {canTransition("reject_screening", st) && (
                <details style={{ marginTop: 18 }}>
                  <summary className="k-btn danger block" style={{ listStyle: "none" }}><Ban aria-hidden="true" />ไม่ผ่านการคัดกรอง</summary>
                  <ActionForm action={rejectAtScreening} submitLabel="บันทึกไม่ผ่าน" submitClass="k-btn danger" id="reject-screen"
                    confirm={{ title: "ยืนยันไม่ผ่านการคัดกรอง?", body: `${a.creatorName} จะถูกย้ายไปกลุ่ม “ไม่ผ่าน” และส่งเสนอ CEO ไม่ได้อีก`, confirmLabel: "ยืนยันไม่ผ่าน", tone: "danger" }}>
                    <input type="hidden" name="applicant_id" value={a.id} />
                    <label className="k-field" style={{ marginTop: 18 }}><span className="k-label">เหตุผล (บันทึกภายใน) *</span><textarea className="k-textarea" name="reason" maxLength={2000} required /></label>
                  </ActionForm>
                </details>
              )}
            </section>
          )}

          {review && !a.erasedAt && (
            <section className="k-card" aria-labelledby="h-links">
              <div className="k-card-h"><h2 id="h-links"><Link2 aria-hidden="true" />ลิงก์สำหรับผู้สมัคร</h2></div>
              <div className="k-deliv">
                <div className="k-row between"><b>STEP 2 · ลงทะเบียน KOL ที่ผ่านคัดเลือก</b>
                  {regLink ? <span className="k-badge nodot" data-tone="green">ใช้ได้ถึง {fmtDate(regLink.expiresAt)}</span> : <span className="k-badge nodot" data-tone="gray">ยังไม่มีลิงก์</span>}</div>
                {regLink && <p className="k-muted k-small" style={{ margin: 0 }}>{regLink.lastUsedAt ? `KOL ใช้ลิงก์ล่าสุด ${fmtDateTime(regLink.lastUsedAt)}` : "KOL ยังไม่ได้ใช้ลิงก์"}</p>}
                {regLink && <RevealCopy tokenId={regLink.id} purpose="registration" name={a.creatorName} expiresAt={regLink.expiresAt.toISOString()} />}
                {(st === "approved" || st === "registered") ? (
                  <ActionForm action={issueApplicantLink} submitLabel={regLink ? "ออกลิงก์ใหม่ (ยกเลิกลิงก์เดิม)" : "สร้างลิงก์ STEP 2"} submitClass="k-btn sm soft">
                    <input type="hidden" name="applicant_id" value={a.id} /><input type="hidden" name="purpose" value="registration" />
                    <label className="k-field"><span className="k-label">อายุลิงก์</span>
                      <select className="k-select" name="days" defaultValue="14"><option value="7">7 วัน</option><option value="14">14 วัน</option><option value="30">30 วัน</option></select></label>
                  </ActionForm>
                ) : <p className="k-muted k-small" style={{ margin: 0 }}>สร้างได้หลัง CEO อนุมัติ (ระบบสร้างให้อัตโนมัติเมื่ออนุมัติ)</p>}
                {regLink && (
                  <ActionForm action={revokeApplicantLink} submitLabel="ยกเลิกลิงก์นี้" submitClass="k-btn sm ghost">
                    <input type="hidden" name="token_id" value={regLink.id} />
                  </ActionForm>
                )}
              </div>
              <div className="k-deliv">
                <div className="k-row between"><b>ลิงก์ติดตามสถานะของผู้สมัคร</b>{statusLink && <span className="k-badge nodot" data-tone="green">ใช้งานได้</span>}</div>
                {statusLink && <RevealCopy tokenId={statusLink.id} purpose="status" name={a.creatorName} expiresAt={statusLink.expiresAt.toISOString()} />}
                <ActionForm action={issueApplicantLink} submitLabel={statusLink ? "ออกลิงก์สถานะใหม่" : "สร้างลิงก์สถานะ"} submitClass="k-btn sm ghost">
                  <input type="hidden" name="applicant_id" value={a.id} /><input type="hidden" name="purpose" value="status" />
                </ActionForm>
              </div>
            </section>
          )}

          <section className="k-card" aria-labelledby="h-cmt">
            <div className="k-card-h"><h2 id="h-cmt"><MessageSquareText aria-hidden="true" />ความคิดเห็น (ทีม + CEO)</h2></div>
            {a.comments.length > 0 ? (
              <ul className="k-comments">
                {a.comments.map((c) => (
                  <li key={c.id} className={`k-comment${c.authorId === user.id ? " mine" : ""}`}>
                    <header><b>{c.authorName}</b><span>{c.authorRole}</span><span>{fmtDateTime(c.at)}</span></header><p>{c.body}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="k-muted k-small" style={{ marginTop: 0 }}>ยังไม่มีความคิดเห็น</p>}
            {!a.erasedAt && <ComposeBox action={addKolComment} hidden={{ applicant_id: a.id, request_id: lastRound?.id ?? "" }} placeholder="พิมพ์ความคิดเห็น…" label="ความคิดเห็น"
              privateNote="ความคิดเห็นภายใน — ผู้สมัครมองไม่เห็น" />}
          </section>

          {review && (
            <section className="k-card" aria-labelledby="h-notes">
              <div className="k-card-h"><h2 id="h-notes"><NotebookPen aria-hidden="true" />หมายเหตุภายใน (Marketing)</h2></div>
              {prev.length > 0 && <ul className="k-comments">{prev.map((r) => <li key={r.id} className="k-comment"><header><b>{r.reviewerName}</b><span>{fmtDateTime(r.at)}</span></header><p>{r.body ?? "(ลบแล้ว)"}</p></li>)}</ul>}
              {!a.erasedAt && <ComposeBox action={addReviewNote} hidden={{ applicant_id: a.id }} placeholder="เพิ่มหมายเหตุการคัดกรอง…" label="หมายเหตุ" />}
            </section>
          )}

          <section className="k-card" aria-labelledby="h-hist">
            <div className="k-card-h"><h2 id="h-hist"><History aria-hidden="true" />ประวัติสถานะ</h2></div>
            <ul className="k-timeline">
              {a.history.slice().reverse().map((h) => (
                <li key={h.id}><div>
                  <b>{STATUS_LABEL[h.to as ApplicantStatus] ?? h.to}</b>
                  <br /><small>{h.actorKind === "applicant" ? "ผู้สมัคร" : h.actorName ?? "ระบบ"} · {fmtDateTime(h.at)}</small>
                  {h.note && <p style={{ margin: "3px 0 0" }}>{h.note}</p>}
                </div></li>
              ))}
            </ul>
          </section>

          {can(user, "privacy.manage") && !a.erasedAt && (
            <section className="k-card" aria-labelledby="h-priv">
              <div className="k-card-h"><h2 id="h-priv"><ShieldAlert aria-hidden="true" />ข้อมูลส่วนบุคคล</h2></div>
              <p className="k-muted k-small" style={{ marginTop: 0 }}>ลบชื่อ เบอร์ LINE Social ไฟล์แนบ คำตอบ และความคิดเห็นของผู้สมัครรายนี้ถาวร (เก็บเฉพาะสถิติและประวัติการดำเนินการ) ใช้เมื่อผู้สมัครขอลบหรือครบกำหนดเก็บรักษา</p>
              <ActionForm action={eraseApplicant} submitLabel={<><Lock aria-hidden="true" />ลบข้อมูลส่วนบุคคล</>} submitClass="k-btn danger">
                <input type="hidden" name="applicant_id" value={a.id} />
                <label className="k-field"><span className="k-label">พิมพ์คำว่า “ลบข้อมูล” เพื่อยืนยัน</span><input className="k-input" name="confirm" autoComplete="off" /></label>
              </ActionForm>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
