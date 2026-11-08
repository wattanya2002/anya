"use client";
import { useActionState, useState } from "react";
import { Check, CircleAlert, LoaderCircle, Plus, RotateCcw, Send } from "lucide-react";
import { approvePerson, approveRequest, returnRequest } from "@/app/(mk)/mk/actions";
import type { FormState } from "@/app/actions";

/** "ยืนยันอนุมัติ": disabled while saving so a double tap cannot submit twice; on failure the approval has no effect and can be retried. */
export function ConfirmApprove({ requestId, personId, label = "ยืนยันอนุมัติ" }: { requestId: string; personId?: string; label?: string }) {
  const [state, act, pending] = useActionState(personId ? approvePerson : approveRequest, {} as FormState);
  return (
    <form action={act} className="ap-stack">
      <input type="hidden" name="request_id" value={requestId} />
      {personId && <input type="hidden" name="person_id" value={personId} />}
      {state.error && !pending && <div role="alert" className="ap-alert"><CircleAlert aria-hidden="true" />{state.error}</div>}
      <button type="submit" className="ap-btn primary block h56" disabled={pending} aria-busy={pending}>
        {pending ? <><LoaderCircle aria-hidden="true" className="spin" />กำลังบันทึก</>
          : state.error ? <><RotateCcw aria-hidden="true" />ลองอีกครั้ง</> : <><Check aria-hidden="true" />{label}</>}
      </button>
    </form>
  );
}

const QUICK = ["ขอข้อมูลเพิ่ม", "ปรับงบ", "ขอภาพใหม่", "เลื่อนวัน"];

/** Send-back sheet body. The reason is required and stays in the box if sending fails. */
export function ReturnForm({ requestId }: { requestId: string }) {
  const [text, setText] = useState("");
  const [state, act, pending] = useActionState(returnRequest, {} as FormState);
  const add = (t: string) => setText((v) => (v.trim() ? `${v.trim()} · ${t}` : t));
  return (
    <form action={act} style={{ display: "contents" }}>
      <input type="hidden" name="request_id" value={requestId} />
      <div className="ap-sheet-in">
        <div className="ap-col">
          <label htmlFor="reason" className="ap-reason-l">เหตุผลที่ส่งกลับ <span>(จำเป็น)</span></label>
          <textarea id="reason" name="reason" className="ap-reason" rows={4} value={text} onChange={(e) => setText(e.target.value)} required maxLength={2000}
            autoFocus aria-describedby="reason-hint" aria-invalid={state.error ? true : undefined} placeholder="บอกทีมว่าต้องแก้อะไร" />
          <p id="reason-hint" className="ap-note">ทีมจะเห็นเหตุผลนี้ในประวัติคำขอ และได้รับแจ้งทันที</p>
          <div className="ap-quick" aria-label="เพิ่มข้อความด่วน">
            {QUICK.map((t) => <button key={t} type="button" onClick={() => add(t)}><Plus aria-hidden="true" />{t}</button>)}
          </div>
          {state.error && !pending && <div role="alert" className="ap-alert" style={{ marginTop: 12 }}><CircleAlert aria-hidden="true" />{state.error}</div>}
        </div>
      </div>
      <div className="ap-sheet-bar">
        <div className="ap-col">
          <button type="submit" className="ap-btn primary block" disabled={pending || !text.trim()} aria-busy={pending}>
            {pending ? <><LoaderCircle aria-hidden="true" className="spin" />กำลังส่ง</> : state.error ? <><RotateCcw aria-hidden="true" />ส่งอีกครั้ง</> : <><Send aria-hidden="true" />ส่งกลับแก้ไข</>}
          </button>
        </div>
      </div>
    </form>
  );
}
