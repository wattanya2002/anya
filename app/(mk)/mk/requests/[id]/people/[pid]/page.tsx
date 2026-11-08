import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, MessageCircle, Users } from "lucide-react";
import { can } from "@/lib/auth";
import { getRequest, mkViewer } from "@/lib/mk";
import { PLATFORM_LABEL, baht, compactCount, refLabel, thaiShort, thaiStamp } from "@/lib/mk-core";
import { Avatar, PlatformIcon, StatusPill } from "@/components/mk/ui";
import { CommentBox } from "@/components/mk/comment-box";

export const metadata = { title: "อินฟลูเอนเซอร์ · MK" };

export default async function PersonPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  const user = await mkViewer();
  const r = await getRequest(user, id);
  const p = r?.people.find((x) => x.id === pid);
  if (!r || !p) notFound();
  const idx = r.people.indexOf(p);
  const ref = refLabel(r.refNo);
  const decide = can(user, "approvals.decide") && r.status === "pending" && p.status === "pending";
  const notes = r.events.filter((e) => e.kind === "comment" && e.personId === p.id);
  const perf = [
    p.avgViews !== null ? { k: "วิวเฉลี่ย", v: compactCount(p.avgViews), s: "ต่อชิ้นงาน" } : null,
    p.engagementBps !== null ? { k: "การมีส่วนร่วม", v: `${(p.engagementBps / 100).toFixed(1)}%`, s: "ไลก์ คอมเมนต์ แชร์" } : null,
    p.audience ? { k: "ผู้ชมหลัก", v: p.audience, s: null, wide: true } : null,
  ].filter((x) => x !== null);
  const terms = [
    p.feeSatang !== null ? ["ค่าจ้าง", baht(p.feeSatang)] : null,
    p.deliverables ? ["ชิ้นงาน", p.deliverables] : null,
    p.deliverBy ? ["วันส่ง", `ภายใน ${thaiShort(p.deliverBy, true)}`] : null,
    p.conditions ? ["เงื่อนไข", p.conditions] : null,
  ].filter((x) => x !== null);
  return (
    <div className="ap" data-tone="white">
      <div className="ap-scroll">
        <div className="ap-hero">
          {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied https photo */}
          {p.photoUrl ? <img src={p.photoUrl} alt={`ภาพโปรไฟล์ ${p.name}`} referrerPolicy="no-referrer" /> : <span className="ap-ph" style={{ color: "#fbe8f0" }}><Users aria-hidden="true" strokeWidth={1.1} /></span>}
          <div className="ap-hero-top">
            <Link href={`/mk/requests/${r.id}#people`} className="ap-ibtn white" aria-label="กลับไปที่คำขอ"><ArrowLeft aria-hidden="true" strokeWidth={1.8} /></Link>
            <span className="ap-pv-count">คนที่ {idx + 1}/{r.people.length}</span>
          </div>
        </div>
        <main id="main" className={`ap-panel${decide ? " bar" : ""}`} style={decide ? undefined : { paddingBottom: "calc(40px + env(safe-area-inset-bottom))" }}>
          <div className="ap-col">
            <div className="ap-title"><h1 style={{ fontSize: 24 }}>{p.name}</h1><StatusPill status={p.status === "approved" ? "approved" : "pending"} /></div>
            <p className="ap-sub" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14.5 }}>
              <PlatformIcon p={p.platform} />{PLATFORM_LABEL[p.platform]}{p.followers !== null ? ` · ${compactCount(p.followers)} ผู้ติดตาม` : ""} · คำขอ <Link href={`/mk/requests/${r.id}`} style={{ textDecoration: "underline" }}>{ref}</Link>
            </p>
            {p.status === "approved" && p.decidedAt && (
              <div className="ap-decided" role="status"><Check aria-hidden="true" /><b>อนุมัติแล้ว โดย {p.decidedByName ?? "—"} · {thaiStamp(p.decidedAt)}</b></div>
            )}
            {p.feeSatang !== null && (
              <div className="ap-amount"><small>ค่าจ้าง</small><b>{baht(p.feeSatang)}</b>
                <span>{[p.deliverables, p.deliverBy ? `ส่งภายใน ${thaiShort(p.deliverBy, true)}` : null].filter(Boolean).join(" · ") || " "}</span></div>
            )}
            {(p.handle || p.profileUrl) && <>
              <h2 id="channels" className="ap-h2">ช่องทางและยอดผู้ติดตาม</h2>
              <div className="ap-surf" style={{ padding: "2px 14px" }}>
                {p.profileUrl ? (
                  <a href={p.profileUrl} target="_blank" rel="noopener noreferrer" className="ap-chan">
                    <span><PlatformIcon p={p.platform} /></span>
                    <span className="ap-chan-text"><b>{PLATFORM_LABEL[p.platform]}</b><span>{p.handle ?? p.profileUrl}</span></span>
                    {p.followers !== null && <b>{compactCount(p.followers)}</b>}<ExternalLink aria-hidden="true" style={{ color: "var(--ap-muted)", width: 16, height: 16 }} />
                  </a>
                ) : (
                  <div className="ap-chan"><span><PlatformIcon p={p.platform} /></span><span className="ap-chan-text"><b>{PLATFORM_LABEL[p.platform]}</b><span>{p.handle}</span></span>{p.followers !== null && <b>{compactCount(p.followers)}</b>}</div>
                )}
              </div>
            </>}
            {perf.length > 0 && <>
              <h2 className="ap-h2">ผลตอบรับ</h2>
              <div className="ap-grid2" style={{ marginTop: 0 }}>
                {perf.map((x) => <div key={x.k} className={`ap-kv${"wide" in x || perf.length === 1 ? " span2" : ""}`}><small>{x.k}</small><b>{x.v}</b>{x.s && <span>{x.s}</span>}</div>)}
              </div>
              <p className="ap-note">ข้อมูลที่ทีมกรอกตอนส่งคำขอ</p>
            </>}
            {terms.length > 0 && <>
              <h2 className="ap-h2">ค่าจ้าง ชิ้นงาน และเงื่อนไข</h2>
              <dl className="ap-dl">{terms.map(([k, v], i) => <div key={k}><dt>{k}</dt><dd style={i === 0 ? { fontWeight: 700 } : undefined}>{v}</dd></div>)}</dl>
            </>}
            {p.fitNote && <>
              <h2 className="ap-h2">ความเหมาะสมกับแคมเปญ</h2>
              <p className="ap-p" style={{ fontSize: 15 }}>{p.fitNote}</p>
              <p className="ap-note">ความเห็นจาก{r.submitterName} · ทีมการตลาด</p>
            </>}
            <h2 id="comments" className="ap-h2">คอมเมนต์ถึงทีม</h2>
            {notes.length > 0 && (
              <ul className="ap-thread" style={{ marginBottom: 6 }}>
                {notes.map((e) => (
                  <li key={e.id} className={`ap-ev${e.actorId === user.id ? " mine" : ""}`}>
                    <Avatar name={e.actorName} me={e.actorId === user.id} />
                    <div className="ap-ev-body"><div className="ap-ev-who"><b>{e.actorId === user.id ? "คุณ" : e.actorName}</b> · {thaiStamp(e.createdAt, false)}</div><div className="ap-ev-msg">{e.body}</div></div>
                  </li>
                ))}
              </ul>
            )}
            <CommentBox requestId={r.id} personId={p.id} id="pcmt" label="คอมเมนต์ถึงทีม" placeholder="เช่น ขอดูคลิปตัวอย่างเพิ่ม" hint={`คอมเมนต์แสดงในประวัติของคำขอ ${ref} และแจ้งทีมทันที`} />
          </div>
        </main>
      </div>
      {decide && (
        <div className="ap-bar">
          <div className="ap-col">
            <a href="#comments" className="ap-btn"><MessageCircle aria-hidden="true" />คอมเมนต์</a>
            <Link href={`/mk/requests/${r.id}/people/${p.id}/confirm`} className="ap-btn primary grow"><Check aria-hidden="true" />อนุมัติคนนี้</Link>
          </div>
        </div>
      )}
    </div>
  );
}
