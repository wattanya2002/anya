import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ClipboardList, ExternalLink, FileText, Gift, Images, Lock, Megaphone, MessagesSquare, PlayCircle, Sparkles, UserRound, Users, History as HistoryIcon } from "lucide-react";
import { DECISION_LABEL, STATUS_LABEL, applicantRef, initials, socialHandle, type ApplicantStatus } from "@/lib/kol-core";
import { platformLabel } from "@/lib/forms-core";
import { KolHead, Pill, PlatformIcon, Empty, fmtDateTime } from "@/components/kol/ui";
import { CeoStrip, DecisionArea, ceoHref, when } from "@/components/kol/ceo-ui";
import { ComposeBox } from "@/components/kol/client";
import { PortfolioGrid } from "@/components/kol/viewer";
import { addKolComment } from "@/app/(app)/kol/actions";
import { loadCeo, decidedOf, type CeoParams } from "../load";

const SECTIONS: Record<string, { title: string; sub: string }> = {
  info: { title: "ข้อมูลส่วนตัว", sub: "ข้อมูลผู้สมัครและแนวคอนเทนต์" },
  social: { title: "Social & ผลงาน", sub: "รายละเอียดโซเชียลและผลงานของ KOL" },
  proposal: { title: "ข้อเสนอ Marketing", sub: "ข้อเสนอและความคิดเห็นจาก Marketing" },
  campaign: { title: "แคมเปญ", sub: "รายละเอียดข้อเสนอแคมเปญการตลาด" },
  comments: { title: "ความคิดเห็น", sub: "ความคิดเห็นภายในทีม" },
  history: { title: "ประวัติ", sub: "สถานะและผลการพิจารณา" },
};
const baht = (satang: number) => `฿${Math.round(satang / 100).toLocaleString("en-US")}`;
const deliverablePlatform = (key: string) => (key.startsWith("ig") ? "instagram" : key.startsWith("tiktok") || key.startsWith("tt") ? "tiktok" : key.startsWith("fb") ? "facebook" : key.startsWith("yt") ? "youtube" : "web");

/** KOL detail screens 07–11 (+ history) under the Detail Hub. */
export default async function CeoSection(p: CeoParams & { params: Promise<{ id: string; section: string }> }) {
  const { section } = await p.params;
  const meta = SECTIONS[section];
  if (!meta) notFound();
  const { user, ctx, canDecide, pending } = await loadCeo(p, (id, tab) => ceoHref.section(id, section, tab));
  const c = ctx.card, a = c.applicant, tab = ctx.tab;
  const images = a.sampleFiles.filter((f) => f.mime.startsWith("image/"));
  const others = a.sampleFiles.filter((f) => !f.mime.startsWith("image/"));
  return (
    <>
      <KolHead user={user} title={meta.title} sub={meta.sub} back={ceoHref.hub(c.requestId, tab)}
        right={<Pill label={`รายการที่ ${ctx.index + 1} จาก ${ctx.total}`}><b>{ctx.index + 1}</b> / {ctx.total}</Pill>} />
      <div style={{ marginTop: 22 }}><CeoStrip name={a.creatorName} refNo={a.refNo} photoFileId={a.photoFileId} social={a.social} pink={section === "campaign"} /></div>

      <div style={{ marginTop: 22 }}>
        {section === "info" && (
          <section className="k-sec" aria-labelledby="s-h">
            <h2 id="s-h"><UserRound aria-hidden="true" />ข้อมูลส่วนตัว</h2>
            <h3>ชื่อ–นามสกุล</h3><p>{a.fullName} · {applicantRef(a.refNo)}</p>
            <h3>แนวคอนเทนต์</h3>{a.categories.length ? <div className="k-pchips">{a.categories.map((x) => <span key={x}>{x}</span>)}</div> : <p>–</p>}
            <h3>ประสบการณ์กีฬา / เทนนิส</h3><p>{a.tennisExperience ?? "–"}</p>
            <h3>แนะนำตัว</h3><p>{a.bio || "–"}</p>
            <h3>เหตุผลที่สนใจร่วมงาน</h3><p>{a.motivation || "–"}</p>
            <h3>สมัครเมื่อ</h3><p>{fmtDateTime(a.createdAt)}</p>
            <div style={{ marginTop: 16 }}><Link href={`/kol/applicants/${a.id}`} className="k-btn sm ghost"><ExternalLink aria-hidden="true" />เปิดใบสมัครเต็ม</Link></div>
          </section>
        )}

        {section === "social" && (
          <>
            <section className="k-sec" aria-labelledby="s-h">
              <h2 id="s-h"><Users aria-hidden="true" />ช่องทาง Social Media</h2>
              {a.social.length ? (
                <div className="k-nets">
                  {a.social.map((s) => {
                    const inner = (
                      <>
                        <span className="k-net"><span className="k-net-ic" data-p={s.platform}><PlatformIcon platform={s.platform} /></span>
                          <span><b>{platformLabel(s.platform)}</b><small>{socialHandle(s.url) ?? "ไม่มีชื่อบัญชีในลิงก์"}</small></span></span>
                        <em><Users aria-hidden="true" />ผู้ติดตาม {s.followers === null ? "ไม่ระบุ" : s.followers.toLocaleString("en-US")}</em>
                      </>
                    );
                    return s.url
                      ? <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${platformLabel(s.platform)} ${socialHandle(s.url) ?? ""} ${s.followers ?? "ไม่ระบุ"} ผู้ติดตาม — เปิดโปรไฟล์`}>{inner}</a>
                      : <div key={s.platform}>{inner}</div>;
                  })}
                </div>
              ) : <p className="k-muted">ผู้สมัครไม่ได้ระบุช่องทาง Social Media</p>}
              <p className="k-hint" style={{ marginTop: 10 }}>จำนวนผู้ติดตามเป็นตัวเลขที่ผู้สมัครหรือทีมกรอก ไม่ได้ดึงจาก Social Media แบบ Real-Time</p>
            </section>
            <section className="k-sec" aria-labelledby="s-port">
              <h2 id="s-port"><Images aria-hidden="true" />Portfolio <span className="k-muted" style={{ marginLeft: "auto", fontSize: 14, fontWeight: 500 }}>ตัวอย่างผลงาน ({images.length + others.length + a.sampleLinks.length})</span></h2>
              {images.length > 0 && <PortfolioGrid files={images.map((f) => ({ id: f.id, name: f.name, tag: "รูป" }))} />}
              {others.length > 0 && (
                <div className="k-port" style={{ marginTop: images.length ? 10 : 0 }}>
                  {others.map((f) => <a key={f.id} href={`/api/kol/files/${f.id}`} target="_blank" rel="noopener noreferrer" className="k-port-file"><FileText aria-hidden="true" /><span className="k-ellipsis" style={{ maxWidth: "100%" }}>{f.name}</span></a>)}
                </div>
              )}
              {a.sampleLinks.length > 0 && (
                <ul className="k-links" style={{ marginTop: images.length || others.length ? 12 : 0 }}>
                  {a.sampleLinks.map((l) => <li key={l}><a href={l} target="_blank" rel="noopener noreferrer"><PlayCircle aria-hidden="true" /><span>{l}</span><ExternalLink aria-hidden="true" /></a></li>)}
                </ul>
              )}
              {!images.length && !others.length && !a.sampleLinks.length && <p className="k-muted">ผู้สมัครไม่ได้แนบตัวอย่างผลงาน</p>}
            </section>
            <section className="k-sec" aria-labelledby="s-style">
              <h2 id="s-style"><Sparkles aria-hidden="true" />Content Style</h2>
              {a.categories.length ? <div className="k-pchips">{a.categories.map((x) => <span key={x}>{x}</span>)}</div> : <p className="k-muted">ไม่ระบุ</p>}
            </section>
          </>
        )}

        {section === "proposal" && (
          <>
            <section className="k-sec" aria-labelledby="s-h">
              <h2 id="s-h"><ClipboardList aria-hidden="true" />ข้อเสนอจาก Marketing</h2>
              <h3>ข้อเสนอสั้น</h3><p>{c.shortPitch}</p>
              <h3>ความเห็น Marketing</h3><p>{c.opinion}</p>
              {c.reason && <><h3>เหตุผลที่เสนอ</h3><p>{c.reason}</p></>}
              {c.highlights && <><h3>จุดเด่นของ KOL</h3><p>{c.highlights}</p></>}
              {c.cautions && <><h3>สิ่งที่ควรระวัง</h3><p>{c.cautions}</p></>}
              <p className="k-muted k-small" style={{ marginTop: 22 }}>เสนอโดย {c.submittedByName} · {when(c.submittedAt)} · รอบที่ {c.roundNo}</p>
            </section>
            {c.rounds.length > 1 && (
              <section className="k-sec" aria-labelledby="s-rounds">
                <h2 id="s-rounds"><HistoryIcon aria-hidden="true" />ประวัติข้อเสนอ</h2>
                <ul className="k-timeline">
                  {c.rounds.slice().reverse().map((r) => (
                    <li key={r.id}><div><b>รอบที่ {r.roundNo} · {DECISION_LABEL[r.status]}</b><br /><small>{r.shortPitch} · เสนอ {when(r.submittedAt)} โดย {r.submittedByName}</small>
                      {r.decision && <p style={{ margin: "3px 0 0", fontSize: 14 }}>{r.decision.byName}: {DECISION_LABEL[r.decision.decision]}{r.decision.note ? ` — ${r.decision.note}` : ""}</p>}</div></li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {section === "campaign" && (
          <section className="k-sec" aria-label="รายละเอียดแคมเปญ">
            <div className="k-cname"><Megaphone aria-hidden="true" />{c.campaignName}</div>
            {c.terms ? (
              <>
                <div className="k-cgroup">
                  <i aria-hidden="true"><Gift /></i>
                  <div><h3>สิทธิประโยชน์</h3>
                    <ul className="k-blist">
                      <li><i aria-hidden="true"><Check /></i><span>เครดิตจองคอร์ท {c.terms.creditHours} ชั่วโมง มูลค่า {baht(c.terms.creditValueSatang)}</span></li>
                      <li><i aria-hidden="true"><Check /></i><span>Promo Code ส่วนลด {c.terms.promoDiscountBps / 100}% สำหรับผู้ติดตาม</span></li>
                    </ul>
                  </div>
                </div>
                <div className="k-cgroup lav">
                  <i aria-hidden="true"><PlayCircle /></i>
                  <div><h3>ผลงานที่ต้องส่ง</h3>
                    <ul className="k-blist">
                      {c.terms.deliverables.map((d) => <li key={d.key}><span className="k-net-ic" data-p={deliverablePlatform(d.key)} style={{ width: 28, height: 28 }}><PlatformIcon platform={deliverablePlatform(d.key)} /></span><span>{d.label}</span></li>)}
                    </ul>
                  </div>
                </div>
                <div className="k-cgroup amber">
                  <i aria-hidden="true"><FileText /></i>
                  <div><h3>เงื่อนไขแคมเปญ</h3>
                    <details className="k-terms">
                      <summary>ดูเงื่อนไขทั้งหมด ({c.terms.items.length} ข้อ · เวอร์ชัน {c.terms.versionNo})</summary>
                      <ol>{c.terms.items.map((t) => <li key={t}>{t}</li>)}</ol>
                    </details>
                  </div>
                </div>
              </>
            ) : <p className="k-muted">ยังไม่ได้ตั้งเงื่อนไขแคมเปญ</p>}
          </section>
        )}

        {section === "comments" && (
          <section className="k-sec" aria-labelledby="s-h">
            <h2 id="s-h" className="sr-only">ความคิดเห็นภายใน</h2>
            {c.comments.length ? (
              <ul className="k-cmts">
                {c.comments.map((m) => (
                  <li key={m.id} className={`k-cmt${m.authorId === user.id ? " mine" : ""}`}>
                    <span className="k-av" aria-hidden="true">{initials(m.authorName)}</span>
                    <div style={{ minWidth: 0 }}>
                      <header><b>{m.authorName}</b><span className="k-code">{m.authorRole}</span><time dateTime={new Date(m.at).toISOString()}>{when(m.at)}</time></header>
                      <p>{m.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Empty icon={<MessagesSquare aria-hidden="true" />} title="ยังไม่มีความคิดเห็น" body="เขียนความคิดเห็นถึงทีมได้ด้านล่าง" />}
            <div style={{ marginTop: 18 }}>
              <ComposeBox action={addKolComment} hidden={{ applicant_id: a.id, request_id: c.requestId }} placeholder="พิมพ์ความคิดเห็นภายใน…" label={`ความคิดเห็นเกี่ยวกับ ${a.creatorName}`} />
              <p className="k-private"><Lock aria-hidden="true" />ผู้สมัครมองไม่เห็น</p>
            </div>
          </section>
        )}

        {section === "history" && (
          <section className="k-sec" aria-labelledby="s-h">
            <h2 id="s-h"><HistoryIcon aria-hidden="true" />ประวัติการพิจารณาและสถานะ</h2>
            <ul className="k-timeline">
              {c.rounds.slice().reverse().map((r) => (
                <li key={`r${r.id}`}><div><b>รอบที่ {r.roundNo} · {DECISION_LABEL[r.status]}</b><br /><small>เสนอ {when(r.submittedAt)} โดย {r.submittedByName}</small>
                  {r.decision && <p style={{ margin: "3px 0 0", fontSize: 14 }}>{r.decision.byName}: {DECISION_LABEL[r.decision.decision]}{r.decision.note ? ` — ${r.decision.note}` : ""} ({when(r.decision.at)})</p>}</div></li>
              ))}
              {c.history.slice().reverse().map((h) => (
                <li key={`h${h.id}`}><div><b>{STATUS_LABEL[h.to as ApplicantStatus] ?? h.to}</b><br /><small>{h.actorKind === "applicant" ? "ผู้สมัคร" : h.actorName ?? "ระบบ"} · {when(h.at)}</small>{h.note && <p style={{ margin: "3px 0 0", fontSize: 14 }}>{h.note}</p>}</div></li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div style={{ marginTop: 22 }}><DecisionArea id={c.requestId} tab={tab} name={a.creatorName} pending={pending} canDecide={canDecide} decided={decidedOf(c)} /></div>
    </>
  );
}
