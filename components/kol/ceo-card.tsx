/* eslint-disable @next/next/no-img-element -- images come from Postgres through our own routes (/api/kol/files, /api/public/hero) or local blob previews; next/image would need a custom loader */
"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Ban, Check, CheckCircle2, ChevronDown, ExternalLink, FileText, Loader2, MessageSquareText, X } from "lucide-react";
import type { CeoCard as Card } from "@/lib/kol";
import { DECISION_LABEL, STATUS_LABEL, applicantRef, compactNumber, initials, type ApplicantStatus } from "@/lib/kol-core";
import { platformLabel } from "@/lib/forms-core";
import { decideApproval, addKolComment, type DecisionResult } from "@/app/(app)/kol/actions";
import { ComposeBox } from "./client";

const dtf = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const when = (d: Date | string) => dtf.format(new Date(d));
const baht = (s: number) => `฿${Math.round(s / 100).toLocaleString("en-US")}`;
type Tab = "kol" | "work" | "campaign" | "mk" | "history" | "comments";
const TABS: { key: Tab; label: string }[] = [
  { key: "mk", label: "ข้อเสนอ Marketing" }, { key: "kol", label: "รายละเอียด KOL" }, { key: "work", label: "Social & ผลงาน" },
  { key: "campaign", label: "แคมเปญ" }, { key: "comments", label: "ความคิดเห็น" }, { key: "history", label: "ประวัติ" },
];

export function CeoList({ cards, canDecide, openId, meId }: { cards: Card[]; canDecide: boolean; openId: string | null; meId: string }) {
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "warn" | "err" } | null>(null);
  return (
    <>
      <div aria-live="polite" role="status">
        {toast && (
          <div className={`k-alert ${toast.tone}`} style={{ marginTop: 14 }}>
            <CheckCircle2 aria-hidden="true" /><span>{toast.text}</span>
            <button type="button" className="k-ibtn" style={{ marginLeft: "auto", width: 32, height: 32, background: "transparent" }} onClick={() => setToast(null)} aria-label="ปิดข้อความ"><X aria-hidden="true" /></button>
          </div>
        )}
      </div>
      <ul className="k-ceo-list">
        {cards.map((c) => <CeoCardView key={c.requestId} card={c} canDecide={canDecide} defaultOpen={c.requestId === openId} meId={meId} onDecided={setToast} />)}
      </ul>
    </>
  );
}

function CeoCardView({ card: c, canDecide, defaultOpen, meId, onDecided }: { card: Card; canDecide: boolean; defaultOpen: boolean; meId: string; onDecided: (t: { text: string; tone: "ok" | "warn" | "err" }) => void }) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<Tab>("mk");
  const [mode, setMode] = useState<"approved" | "info_requested" | "rejected" | null>(null);
  const ref = useRef<HTMLLIElement>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [state, act, pending] = useActionState(async (prev: DecisionResult, fd: FormData) => {
    const r = await decideApproval(prev, fd);
    if (confirmRef.current) confirmRef.current.value = "";
    if (r.decided) {
      const name = c.applicant.creatorName;
      onDecided(r.decided.status === "approved"
        ? { text: `อนุมัติ ${name} แล้ว (บันทึกโดย ${r.decided.byName} ${when(r.decided.at)}) — ระบบสร้างลิงก์ STEP 2 ให้ Marketing ส่งทาง LINE แล้ว`, tone: "ok" }
        : r.decided.status === "rejected" ? { text: `บันทึกไม่อนุมัติ ${name} แล้ว (${when(r.decided.at)})`, tone: "warn" }
        : { text: `ส่งคำขอข้อมูลเพิ่มของ ${name} ให้ Marketing แล้ว (${when(r.decided.at)})`, tone: "warn" });
      setMode(null);
    }
    return r;
  }, {} as DecisionResult);
  useEffect(() => { if (defaultOpen) ref.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [defaultOpen]);

  const a = c.applicant;
  const pendingCard = c.requestStatus === "pending" && !state.decided;
  const decided = state.decided ?? (c.decision ? { status: c.decision.decision, byName: c.decision.byName, at: String(c.decision.at) } : null);
  const bodyId = `ceo-body-${c.requestId}`;
  return (
    <li ref={ref} className="k-ceo" data-open={open} aria-labelledby={`ceo-n-${c.requestId}`}>
      <div className="k-ceo-top">
        <span className="k-av" aria-hidden="true">{a.photoFileId ? <img src={`/api/kol/files/${a.photoFileId}`} alt="" loading="lazy" /> : initials(a.creatorName)}</span>
        <div style={{ minWidth: 0 }}>
          <h2 id={`ceo-n-${c.requestId}`} className="k-ceo-name">{a.creatorName}</h2>
          <div className="k-ceo-cats">{a.categories.join(" · ") || "ไม่ระบุประเภทคอนเทนต์"}</div>
        </div>
        <span className="k-badge" data-tone={decided?.status === "approved" ? "green" : decided?.status === "rejected" ? "red" : decided?.status === "info_requested" ? "amber" : "navy"}>
          {decided ? DECISION_LABEL[decided.status] : "รอพิจารณา"}
        </span>
      </div>
      <div className="k-social">
        {a.social.length ? a.social.map((s) => <span key={s.platform} className="k-soc">{platformLabel(s.platform)} <b>{compactNumber(s.followers)}</b></span>) : <span className="k-muted k-small">ไม่มีข้อมูลผู้ติดตาม</span>}
      </div>
      <p className="k-ceo-pitch"><b>ข้อเสนอจาก Marketing</b>{c.shortPitch}</p>
      <button type="button" className="k-ceo-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
        {open ? "ย่อรายละเอียด" : "ดูรายละเอียดและตัดสินใจ"}<ChevronDown aria-hidden="true" />
      </button>

      {open && (
        <div className="k-ceo-body" id={bodyId}>
          <div className="k-ceo-tabs" role="tablist" aria-label={`ข้อมูลของ ${a.creatorName}`}>
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} aria-controls={`${bodyId}-${t.key}`} onClick={() => setTab(t.key)}>
                {t.label}{t.key === "comments" && c.comments.length ? ` (${c.comments.length})` : ""}
              </button>
            ))}
          </div>
          <div className="k-ceo-pane" role="tabpanel" id={`${bodyId}-${tab}`}>
            {tab === "mk" && (
              <>
                <h4>ความเห็น Marketing</h4><p>{c.opinion}</p>
                {c.reason && <><h4>เหตุผลที่เสนอ</h4><p>{c.reason}</p></>}
                {c.highlights && <><h4>จุดเด่นของ KOL</h4><p>{c.highlights}</p></>}
                {c.cautions && <><h4>สิ่งที่ควรระวัง</h4><p>{c.cautions}</p></>}
                <p className="k-muted k-small" style={{ marginTop: 12 }}>เสนอโดย {c.submittedByName} · {when(c.submittedAt)} · รอบที่ {c.roundNo}</p>
              </>
            )}
            {tab === "kol" && (
              <>
                <h4>ชื่อ–นามสกุล</h4><p>{a.fullName} · {applicantRef(a.refNo)}</p>
                <h4>แนวคอนเทนต์</h4><p>{a.categories.join(", ") || "–"}</p>
                <h4>ประสบการณ์กีฬา / เทนนิส</h4><p>{a.tennisExperience ?? "–"}</p>
                {a.bio && <><h4>แนะนำตัว</h4><p>{a.bio}</p></>}
                {a.motivation && <><h4>เหตุผลที่สนใจ</h4><p>{a.motivation}</p></>}
                <p className="k-muted k-small" style={{ marginTop: 12 }}>สมัครเมื่อ {when(a.createdAt)} · <a href={`/kol/applicants/${a.id}`} style={{ textDecoration: "underline" }}>เปิดใบสมัครเต็ม</a></p>
              </>
            )}
            {tab === "work" && (
              <>
                <h4>ลิงก์ Social Media</h4>
                <ul className="k-files">
                  {a.social.filter((s) => s.url).map((s) => <li key={s.platform}><a href={s.url!} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />{platformLabel(s.platform)} · {s.followers?.toLocaleString("en-US") ?? "–"} ผู้ติดตาม</a></li>)}
                  {!a.social.some((s) => s.url) && <li className="k-muted k-small">ไม่มีลิงก์</li>}
                </ul>
                {a.sampleLinks.length > 0 && <><h4>ลิงก์ผลงาน</h4><ul className="k-files">{a.sampleLinks.map((l) => <li key={l}><a href={l} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" /><span className="k-ellipsis">{l}</span></a></li>)}</ul></>}
                {a.sampleFiles.length > 0 && <><h4>ตัวอย่างผลงาน</h4><div className="k-thumbs">{a.sampleFiles.map((f) => f.mime.startsWith("image/")
                  ? <a key={f.id} href={`/api/kol/files/${f.id}`} target="_blank" rel="noopener noreferrer" aria-label={`เปิดรูป ${f.name}`}><img src={`/api/kol/files/${f.id}`} alt={f.name} loading="lazy" /></a>
                  : <a key={f.id} href={`/api/kol/files/${f.id}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><FileText aria-hidden="true" /></a>)}</div></>}
                {!a.sampleLinks.length && !a.sampleFiles.length && <><h4>ผลงาน</h4><p className="k-muted">ผู้สมัครไม่ได้แนบตัวอย่างผลงาน</p></>}
              </>
            )}
            {tab === "campaign" && (
              <>
                <h4>แคมเปญ</h4><p>{c.campaignName}{c.terms ? ` · เงื่อนไขเวอร์ชัน ${c.terms.versionNo}` : ""}</p>
                {c.terms && <>
                  <h4>สิทธิประโยชน์</h4>
                  <p>เครดิตจองคอร์ท {c.terms.creditHours} ชั่วโมง มูลค่า {baht(c.terms.creditValueSatang)}{"\n"}Promo Code ส่วนลด {c.terms.promoDiscountBps / 100}% สำหรับผู้ติดตาม</p>
                  <h4>ผลงานที่ต้องส่ง</h4><p>{c.terms.deliverables.map((d) => `• ${d.label}`).join("\n")}</p>
                  <h4>เงื่อนไขทั้งหมด</h4><p>{c.terms.items.map((t) => `• ${t}`).join("\n")}</p>
                </>}
              </>
            )}
            {tab === "history" && (
              <ul className="k-timeline">
                {c.rounds.slice().reverse().map((r) => (
                  <li key={`r${r.id}`}><div><b>รอบที่ {r.roundNo} · {DECISION_LABEL[r.status]}</b><br /><small>เสนอ {when(r.submittedAt)} โดย {r.submittedByName}</small>
                    {r.decision && <p style={{ margin: "3px 0 0" }}>{r.decision.byName}: {DECISION_LABEL[r.decision.decision]}{r.decision.note ? ` — ${r.decision.note}` : ""} ({when(r.decision.at)})</p>}</div></li>
                ))}
                {c.history.slice().reverse().map((h) => (
                  <li key={`h${h.id}`}><div><b>{STATUS_LABEL[h.to as ApplicantStatus] ?? h.to}</b><br /><small>{h.actorKind === "applicant" ? "ผู้สมัคร" : h.actorName ?? "ระบบ"} · {when(h.at)}</small></div></li>
                ))}
              </ul>
            )}
            {tab === "comments" && (
              <>
                {c.comments.length ? (
                  <ul className="k-comments">
                    {c.comments.map((m) => <li key={m.id} className={`k-comment${m.authorId === meId ? " mine" : ""}`}><header><b>{m.authorName}</b><span>{m.authorRole}</span><span>{when(m.at)}</span></header><p>{m.body}</p></li>)}
                  </ul>
                ) : <p className="k-muted k-small">ยังไม่มีความคิดเห็น</p>}
                <ComposeBox action={addKolComment} hidden={{ applicant_id: a.id, request_id: c.requestId }} placeholder="พิมพ์ความคิดเห็นถึงทีม…" label={`ความคิดเห็นเกี่ยวกับ ${a.creatorName}`} privateNote="ความคิดเห็นภายใน — ผู้สมัครมองไม่เห็น" />
              </>
            )}
          </div>

          {decided && (
            <div className="k-ceo-decided" data-s={decided.status} role="status">
              <b>{DECISION_LABEL[decided.status]}</b> โดย {decided.byName} · {when(decided.at)}{c.decision?.note && !state.decided ? <><br />{c.decision.note}</> : null}
            </div>
          )}

          {pendingCard && canDecide && (
            <form ref={formRef} action={act} noValidate aria-busy={pending}
              onSubmit={(e) => { if (mode === "rejected" && confirmRef.current?.value !== "yes") { e.preventDefault(); dlg.current?.showModal(); } }}>
              <input type="hidden" name="request_id" value={c.requestId} />
              <input type="hidden" name="decision" value={mode ?? ""} />
              <input ref={confirmRef} type="hidden" name="confirm" defaultValue="" />
              {mode && (
                <div style={{ marginTop: 12 }}>
                  <label className="k-label" htmlFor={`note-${c.requestId}`}>
                    {mode === "approved" ? "หมายเหตุถึงทีม (ไม่บังคับ)" : mode === "rejected" ? "เหตุผลที่ไม่อนุมัติ *" : "ต้องการข้อมูลอะไรเพิ่ม *"}
                  </label>
                  <textarea id={`note-${c.requestId}`} name="note" className="k-textarea" maxLength={2000} rows={3} required={mode !== "approved"} autoFocus />
                </div>
              )}
              {state.error && !pending && <p className="k-alert err" role="alert" style={{ marginTop: 10 }}><AlertCircle aria-hidden="true" />{state.error}</p>}
              <div className="k-ceo-bar">
                {!mode ? (
                  <>
                    <button type="button" className="k-btn green" onClick={() => setMode("approved")}><Check aria-hidden="true" />Approve</button>
                    <button type="button" className="k-btn amber" onClick={() => setMode("info_requested")}><MessageSquareText aria-hidden="true" />ขอข้อมูลเพิ่ม</button>
                    <button type="button" className="k-btn danger" onClick={() => setMode("rejected")}><Ban aria-hidden="true" />Reject</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="k-btn" onClick={() => setMode(null)} disabled={pending}>ยกเลิก</button>
                    <button type="submit" className={`k-btn ${mode === "approved" ? "green" : mode === "rejected" ? "danger-solid" : "amber"}`} style={{ gridColumn: "span 2" }} disabled={pending}>
                      {pending ? <><Loader2 className="spin" aria-hidden="true" />กำลังบันทึก…</> : mode === "approved" ? "ยืนยันอนุมัติ" : mode === "rejected" ? "ไม่อนุมัติ" : "ส่งคำขอข้อมูล"}
                    </button>
                  </>
                )}
              </div>
              <dialog ref={dlg} className="k-dialog" aria-labelledby={`dlg-${c.requestId}`}>
                <div className="k-dialog-body">
                  <h2 id={`dlg-${c.requestId}`}>ยืนยันไม่อนุมัติ {a.creatorName}?</h2>
                  <p>ผู้สมัครจะอยู่ในกลุ่ม “ไม่ผ่าน” และส่งพิจารณาใหม่ไม่ได้</p>
                  <div className="k-actions end">
                    <button type="button" className="k-btn" onClick={() => dlg.current?.close()}>กลับไปแก้</button>
                    <button type="button" className="k-btn danger-solid" onClick={() => { if (confirmRef.current) confirmRef.current.value = "yes"; dlg.current?.close(); formRef.current?.requestSubmit(); }}>ยืนยันไม่อนุมัติ</button>
                  </div>
                </div>
              </dialog>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
