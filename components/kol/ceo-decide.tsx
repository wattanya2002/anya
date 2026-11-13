"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, BarChart3, BriefcaseBusiness, Check, CircleCheck, Link2, Loader2, MessageSquareMore, Send, Trophy, X } from "lucide-react";
import { INFO_REASONS, REJECT_REASONS, decisionNote } from "@/lib/kol-core";
import { decideApproval, type DecisionResult } from "@/app/(app)/kol/actions";

type Kind = "reject" | "request" | "approve";
const DECISION: Record<Kind, string> = { reject: "rejected", request: "info_requested", approve: "approved" };
const INFO_ICONS = [<BriefcaseBusiness key="a" aria-hidden="true" />, <BarChart3 key="b" aria-hidden="true" />, <Trophy key="c" aria-hidden="true" />];

/** CEO decision screens (Master RCM 12–14): choose → check → confirm. Saved by the existing decision action; the result comes from the backend. */
export function DecideForm({ kind, requestId, name, campaign, backHref, doneHref }: { kind: Kind; requestId: string; name: string; campaign: string; backHref: string; doneHref: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [local, setLocal] = useState("");
  const max = kind === "request" ? 300 : 500;
  const [state, act, pending] = useActionState(async (prev: DecisionResult, fd: FormData) => {
    const r = await decideApproval(prev, fd);
    if (r.decided) router.replace(doneHref);
    return r;
  }, {} as DecisionResult);
  const composed = decisionNote(reason, note);
  const reasons = kind === "reject" ? REJECT_REASONS : kind === "request" ? INFO_REASONS : [];

  return (
    <form className="k-dc" action={act} aria-busy={pending} noValidate
      onSubmit={(e) => { if (kind !== "approve" && !composed) { e.preventDefault(); setLocal("เลือกเหตุผล หรือพิมพ์หมายเหตุ"); } else setLocal(""); }}>
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="decision" value={DECISION[kind]} />
      <input type="hidden" name="note" value={kind === "approve" ? note.trim() : composed} />
      {kind === "reject" && <input type="hidden" name="confirm" value="yes" />}

      <div className={`k-dc-ic ${kind === "reject" ? "x" : kind === "approve" ? "ok" : "ask"}`} aria-hidden="true">
        {kind === "reject" ? <X /> : kind === "approve" ? <Check /> : <MessageSquareMore />}
      </div>
      <h2>{kind === "reject" ? "ไม่อนุมัติ" : kind === "approve" ? "ยืนยันอนุมัติ" : "ขอข้อมูลเพิ่มเติม"}</h2>
      <p className="k-dc-sub">
        {kind === "reject" ? "กรุณาเลือกเหตุผลในการไม่อนุมัติ" : kind === "approve" ? `อนุมัติ ${name} เข้าร่วม ${campaign}` : `เลือกข้อมูลที่ต้องการจาก ${name}`}
      </p>

      {kind !== "approve" && (
        <fieldset className="k-opts">
          <legend className="sr-only">{kind === "reject" ? "เหตุผลที่ไม่อนุมัติ" : "ข้อมูลที่ต้องการเพิ่ม"}</legend>
          {reasons.map((r, i) => (
            <label key={r} className={`k-opt${kind === "reject" ? " noicon" : ""}`}>
              <input type="radio" name="reason_pick" value={r} checked={reason === r} onChange={() => { setReason(r); setLocal(""); }}
                onClick={() => { if (reason === r) setReason(""); }} />
              {kind === "request" && INFO_ICONS[i]}
              <span>{r}</span>
            </label>
          ))}
        </fieldset>
      )}

      {kind === "approve" && (
        <ul className="k-dc-sum">
          <li><CircleCheck aria-hidden="true" /><span>สถานะของ {name} จะเปลี่ยนเป็น <b>CEO อนุมัติแล้ว</b> และบันทึกผู้อนุมัติกับเวลาในประวัติ</span></li>
          <li><Link2 aria-hidden="true" /><span>ระบบสร้างลิงก์ STEP 2 (อายุ 14 วัน) ให้ Marketing คัดลอกไปส่งให้ KOL ทาง LINE — ระบบไม่ได้ส่ง LINE เอง</span></li>
        </ul>
      )}

      <label className="k-field">
        <span className="k-label">{kind === "approve" ? "หมายเหตุถึงทีม" : "หมายเหตุ"} <small>(ไม่บังคับ)</small></span>
        <textarea className="k-textarea" name="note_text" value={note} maxLength={max} rows={3} placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)"
          onChange={(e) => { setNote(e.target.value); setLocal(""); }} aria-describedby={`cnt-${kind}`} />
        <span className="k-counter" id={`cnt-${kind}`}>{note.length} / {max}</span>
      </label>

      {kind !== "approve" && composed && (
        <p className="k-dc-note"><b>สิ่งที่จะบันทึก:</b> {composed}</p>
      )}
      {kind === "reject" && <p className="k-dc-note">ผู้สมัครจะอยู่ในกลุ่ม “ไม่ผ่าน” และส่งพิจารณาใหม่ไม่ได้</p>}

      {(local || (state.error && !pending)) && <p className="k-alert err" role="alert" style={{ marginTop: 22 }}><AlertCircle aria-hidden="true" />{local || state.error}</p>}

      <div className="k-dc-acts">
        <Link href={backHref} className={`k-btn cancel${kind === "request" ? "" : " outline"}`} aria-disabled={pending || undefined}>ยกเลิก</Link>
        <button type="submit" className={`k-btn ${kind === "reject" ? "danger-solid" : kind === "approve" ? "green" : "primary"}`} disabled={pending}>
          {pending ? <><Loader2 className="spin" aria-hidden="true" />กำลังบันทึก…</>
            : kind === "reject" ? "ยืนยันการไม่อนุมัติ" : kind === "approve" ? <><Check aria-hidden="true" />ยืนยันอนุมัติ</> : <><Send aria-hidden="true" />ส่งคำขอข้อมูล</>}
        </button>
      </div>
    </form>
  );
}
