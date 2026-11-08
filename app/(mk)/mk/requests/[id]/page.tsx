import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, FileText, Image as ImageIcon, Inbox, Link as LinkIcon, MessageCircle, Pencil, RotateCcw, Target, Users } from "lucide-react";
import { can } from "@/lib/auth";
import { bangkokToday } from "@/lib/dates";
import { getRequest, type RequestDetail, mkViewer } from "@/lib/mk";
import { diffDays } from "@/lib/calendar-core";
import {
  KIND_LABEL, PRIORITY_OPTIONS, baht, daysLeftLabel, refLabel, thaiRange, thaiShort, thaiStamp,
} from "@/lib/mk-core";
import { Avatar, StatusPill, Toast } from "@/components/mk/ui";
import { PersonCard } from "@/components/mk/person-card";
import { Preview, PreviewThumb } from "@/components/mk/preview";
import { CommentBox } from "@/components/mk/comment-box";

export const metadata = { title: "รายละเอียดคำขอ · MK" };

function amountBox(r: RequestDetail): { label: string; value: string; sub: string | null } | null {
  if (r.kind === "promotion" && r.discountText) {
    return { label: "ส่วนลด", value: r.discountText, sub: r.amountSatang !== null ? `งบ ${baht(r.amountSatang)}` : null };
  }
  if (r.amountSatang === null) return null;
  if (r.kind === "influencer") {
    return { label: "ค่าจ้างรวม", value: baht(r.amountSatang), sub: r.people.length ? `${r.people.length} คน` : null };
  }
  let sub: string | null = null;
  if (r.kind === "ad" && r.startsOn && r.endsOn) {
    const days = diffDays(r.startsOn, r.endsOn) + 1;
    if (days > 1) sub = `เฉลี่ยราว ${baht(Math.round(r.amountSatang / days))} ต่อวัน · ${days} วัน`;
  }
  return { label: r.kind === "ad" ? "งบรวมที่ขอ" : "งบประมาณ", value: baht(r.amountSatang), sub };
}

function periodText(r: RequestDetail): { value: string; sub: string } | null {
  if (!r.startsOn) return null;
  const end = r.endsOn ?? r.startsOn;
  const days = diffDays(r.startsOn, end) + 1;
  const time = !r.allDay && r.startTime ? `${r.startTime}${r.endTime ? `–${r.endTime}` : ""} น.` : "ทั้งวัน";
  return { value: thaiRange(r.startsOn, end), sub: `${days} วัน · ${time}` };
}

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await mkViewer();
  const r = await getRequest(user, id);
  if (!r) notFound();
  const today = bangkokToday();
  const ref = refLabel(r.refNo);
  const comments = r.events.filter((e) => e.kind === "comment").length;
  const images = r.attachments.filter((a) => a.kind === "image").map((a) => ({ id: a.id, url: a.url, label: a.label }));
  const files = r.attachments.filter((a) => a.kind !== "image");
  const amount = amountBox(r);
  const period = periodText(r);
  const isMine = r.submittedBy === user.id;
  const decide = can(user, "approvals.decide") && r.status === "pending";
  const canEdit = (isMine || can(user, "admin.manage")) && can(user, "approvals.submit") && r.status !== "approved";
  const left = daysLeftLabel(r.decideBy, today);
  const late = r.decideBy < today;
  const personName = (pid: string | null) => (pid ? r.people.find((p) => p.id === pid)?.name ?? null : null);
  const bar = decide || (canEdit && r.status === "returned");
  const pendingPeople = r.people.filter((p) => p.status === "pending").length;

  return (
    <div className="ap" data-tone="white">
      {sp.saved && <Toast title={r.status === "pending" ? "ส่งคำขอแล้ว" : "บันทึกแล้ว"} sub={`${ref} · แจ้งผู้อนุมัติแล้ว`} />}
      <div className="ap-scroll">
        <div className="ap-dtop">
          <div className="ap-col">
            <div className="ap-dhead">
              <Link href="/mk" className="ap-ibtn white" aria-label="กลับไปหน้ารวมคำขอ"><ArrowLeft aria-hidden="true" strokeWidth={1.8} /></Link>
              <div className="ap-dhead-mid"><b>{ref}</b><span>{KIND_LABEL[r.kind]}</span></div>
              <div className="ap-head-right">
                {canEdit && <Link href={`/mk/new?edit=${r.id}`} className="ap-ibtn white" aria-label="แก้ไขคำขอ"><Pencil aria-hidden="true" strokeWidth={1.8} style={{ width: 20, height: 20 }} /></Link>}
                <a href="#thread" className="ap-ibtn white" aria-label={`ไปที่คอมเมนต์ ${comments} รายการ`}>
                  <MessageCircle aria-hidden="true" strokeWidth={1.8} />{comments > 0 && <span className="ap-badge" aria-hidden="true">{comments}</span>}
                </a>
              </div>
            </div>
            <Preview requestKey={r.id} images={images} title={r.title} refNo={ref} status={<StatusPill status={r.status} className="sm" />} />
          </div>
        </div>

        <main id="main" className={`ap-panel${bar ? " bar" : ""}`} style={bar ? undefined : { paddingBottom: "calc(40px + env(safe-area-inset-bottom))" }}>
          <div className="ap-col">
            <div className="ap-title"><h1>{r.title}</h1><StatusPill status={r.status} /></div>
            <p className="ap-sub">{KIND_LABEL[r.kind]} · ส่งเมื่อ {thaiStamp(r.createdAt)}{r.urgent ? " · ด่วน" : ""}</p>

            {r.status !== "pending" && r.decidedAt && (
              <div className={`ap-decided${r.status === "returned" ? " returned" : ""}`} role="status">
                {r.status === "approved" ? <Check aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                <span><b>{r.status === "approved" ? "อนุมัติแล้ว" : "ส่งกลับแก้ไข"} โดย {r.decidedByName ?? "—"} · {thaiStamp(r.decidedAt)}</b>
                  {r.status === "returned" && r.decisionNote && <span style={{ whiteSpace: "pre-line" }}>เหตุผล: {r.decisionNote}</span>}</span>
              </div>
            )}

            <div className="ap-label">สิ่งที่ขออนุมัติ</div>
            <p className="ap-p">{r.summary}</p>

            {amount && (
              <div className="ap-amount"><small>{amount.label}</small><b>{amount.value}</b>{amount.sub && <span>{amount.sub}</span>}</div>
            )}
            {(r.channel || period) && (
              <div className="ap-grid2">
                {r.channel && <div className={`ap-kv${period ? "" : " span2"}`}><small>ช่องทาง</small><b>{r.channel}</b></div>}
                {period && <div className={`ap-kv${r.channel ? "" : " span2"}`}><small>ระยะเวลา</small><b>{period.value}</b><span>{period.sub}</span></div>}
              </div>
            )}
            <div className="ap-grid2 ap-kv" style={{ padding: "14px 16px", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <small style={{ display: "block", fontSize: 13, color: "var(--ap-muted)", fontWeight: 600 }}>ผู้ขอ</small>
                <div className="ap-who"><Avatar name={r.submitterName} /><div style={{ minWidth: 0 }}><b>{r.submitterName}</b><span>{isMine ? "คุณ" : "ทีมการตลาด"}</span></div></div>
              </div>
              <div style={{ minWidth: 0 }}>
                <small style={{ display: "block", fontSize: 13, color: "var(--ap-muted)", fontWeight: 600 }}>กำหนดตัดสินใจ</small>
                <b style={{ display: "block", fontSize: 15.5, marginTop: 6 }}>{thaiShort(r.decideBy, true)}</b>
                {r.status === "pending" && <span className={late ? "late" : "warn"} style={{ display: "block", fontSize: 13, fontWeight: 600, color: late ? "var(--ap-red)" : "var(--ap-amber)" }}>{left}</span>}
              </div>
            </div>

            {r.kind === "influencer" && (
              <>
                <h2 className="ap-h2" id="people">อินฟลูเอนเซอร์ · {r.people.length} คน{pendingPeople && r.status === "pending" ? ` (รอตัดสินใจ ${pendingPeople})` : ""}</h2>
                <ul className="ap-people" style={{ marginTop: 0 }}>
                  {r.people.map((p) => <PersonCard key={p.id} p={p} href={`/mk/requests/${r.id}/people/${p.id}`} />)}
                </ul>
              </>
            )}

            {r.goal && <>
              <h2 className="ap-h2">เป้าหมาย</h2>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "var(--ap-pinkd)", marginTop: 3 }}><Target aria-hidden="true" style={{ width: 18, height: 18 }} /></span>
                <p className="ap-p" style={{ margin: 0, fontSize: 15 }}>{r.goal}</p>
              </div>
            </>}

            {images.length > 0 && <>
              <h2 className="ap-h2">{r.kind === "ad" ? "ภาพแอด" : "ภาพประกอบ"}</h2>
              <div className="ap-thumbs">{images.map((im, i) => <PreviewThumb key={im.id} img={im} index={i} />)}</div>
            </>}

            {r.adCopy && <><h2 className="ap-h2">ข้อความแอด</h2><blockquote className="ap-quote">{r.adCopy}</blockquote></>}
            {r.plan && <><h2 className="ap-h2">{r.kind === "ad" ? "แผนยิงแอด" : "แผนงาน"}</h2><div className="ap-quote">{r.plan}</div></>}
            {r.conditions && <><h2 className="ap-h2">เงื่อนไข</h2><div className="ap-quote">{r.conditions}</div></>}

            {(files.length > 0 || r.linkUrl) && <>
              <h2 className="ap-h2">ไฟล์และลิงก์</h2>
              <ul className="ap-files">
                {files.map((f) => (
                  <li key={f.id}><a href={f.url} target="_blank" rel="noopener noreferrer">{f.kind === "file" ? <FileText aria-hidden="true" /> : <LinkIcon aria-hidden="true" />}<span>{f.label}</span><ExternalLink aria-hidden="true" /></a></li>
                ))}
                {r.linkUrl && <li><a href={r.linkUrl} target="_blank" rel="noopener noreferrer"><LinkIcon aria-hidden="true" /><span>{r.linkUrl}</span><ExternalLink aria-hidden="true" /></a></li>}
              </ul>
            </>}

            {(r.note || r.tags.length > 0 || r.flagged || r.priority !== "normal" || r.invitees) && <>
              <h2 className="ap-h2">ข้อมูลเพิ่มเติม</h2>
              <dl className="ap-dl">
                {r.note && <div><dt>โน้ต</dt><dd>{r.note}</dd></div>}
                {r.priority !== "normal" && <div><dt>ความสำคัญ</dt><dd>{PRIORITY_OPTIONS.find((o) => o.value === r.priority)?.label ?? r.priority}</dd></div>}
                {r.flagged && <div><dt>ติดธง</dt><dd>ใช่</dd></div>}
                {r.invitees && <div><dt>ผู้รับเชิญ</dt><dd>{r.invitees}</dd></div>}
              </dl>
              {r.tags.length > 0 && <div className="ap-tags">{r.tags.map((t) => <span key={t} className="ap-tag pink">{t}</span>)}</div>}
            </>}

            <h2 id="thread" className="ap-h2">ประวัติและคอมเมนต์</h2>
            <ul className="ap-thread">
              {r.events.map((e) => {
                const about = personName(e.personId);
                if (e.kind === "comment") {
                  const mine = e.actorId === user.id;
                  return (
                    <li key={e.id} className={`ap-ev${mine ? " mine" : ""}`}>
                      <Avatar name={e.actorName} me={mine} />
                      <div className="ap-ev-body">
                        <div className="ap-ev-who"><b>{mine ? "คุณ" : e.actorName}</b> · {thaiStamp(e.createdAt, false)}</div>
                        <div className="ap-ev-msg">{e.body}</div>
                        {about && <span className="ap-ev-about">เกี่ยวกับ {about}</span>}
                      </div>
                    </li>
                  );
                }
                const text = e.kind === "submitted" ? `${e.actorName} ส่งคำขอ`
                  : e.kind === "resubmitted" ? `${e.actorName} แก้ไขแล้วส่งอีกครั้ง`
                  : e.kind === "approved" ? `${e.actorName} อนุมัติ${about ? ` ${about}` : ""}`
                  : `${e.actorName} ส่งกลับแก้ไข${e.body ? ` · ${e.body}` : ""}`;
                return (
                  <li key={e.id} className={`ap-ev sys ${e.kind}`}>
                    <span>{e.kind === "approved" ? <Check aria-hidden="true" /> : e.kind === "returned" ? <RotateCcw aria-hidden="true" /> : <Inbox aria-hidden="true" />}</span>
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{text} · {thaiStamp(e.createdAt, false)}</span>
                  </li>
                );
              })}
            </ul>
            <CommentBox requestId={r.id} label="เขียนคอมเมนต์ถึงทีม" placeholder="เขียนคอมเมนต์ถึงทีม" />
            {images.length === 0 && r.kind === "ad" && <p className="ap-note"><ImageIcon aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: -2 }} /> คำขอนี้ยังไม่มีภาพแอดแนบมา</p>}
          </div>
        </main>
      </div>

      {bar && (
        <div className="ap-bar">
          <div className="ap-col">
            {decide ? (
              <>
                <Link href={`/mk/requests/${r.id}/return`} className="ap-btn"><RotateCcw aria-hidden="true" />ส่งกลับแก้ไข</Link>
                {r.kind === "influencer"
                  ? <a href="#people" className="ap-btn primary grow"><Users aria-hidden="true" />อนุมัติรายคน</a>
                  : <Link href={`/mk/requests/${r.id}/confirm`} className="ap-btn primary grow"><Check aria-hidden="true" />อนุมัติ</Link>}
              </>
            ) : (
              <Link href={`/mk/new?edit=${r.id}`} className="ap-btn primary grow"><Pencil aria-hidden="true" />แก้ไขแล้วส่งใหม่</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
