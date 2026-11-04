"use client";
import { useActionState, useState } from "react";
import { saveCalendarEvent } from "@/app/(app)/calendar/actions";
import type { FormState } from "@/app/actions";
import type { EditableEvent, Member } from "@/lib/calendar";
import { KIND_TH, MANUAL_KINDS, REMIND_OPTIONS, REPEAT_TH, STATUS_TH, VISIBILITY_TH, type ManualKind } from "@/lib/calendar-core";

export function EventForm({ event, members, me, defaultDate, defaultKind, canFollowup, canExecutive }: {
  event: EditableEvent | null; members: { id: string; name: string }[] | Member[]; me: string; defaultDate: string;
  defaultKind?: ManualKind; canFollowup: boolean; canExecutive: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCalendarEvent, {});
  const f = state.fields;
  const v = (k: string, fb: string | number | null | undefined) => (f && k in f ? f[k] : fb ?? "") as string;
  const [allDay, setAllDay] = useState(f ? f.allDay === "on" : event ? event.allDay : false);
  const [repeat, setRepeat] = useState(v("repeat", event?.repeat ?? "none"));
  const kinds = MANUAL_KINDS.filter((k) => k !== "followup" || canFollowup || event?.kind === "followup");

  return (
    <form action={action} className="form-grid cal-form" key={event ? event.id : state.nonce ?? "new"}>
      {event && <input type="hidden" name="id" value={event.id} />}
      <div className="field span-2"><label htmlFor="c-title">ชื่อรายการ *</label>
        <input id="c-title" name="title" required maxLength={160} placeholder="เช่น ประชุมทีมการตลาด" defaultValue={v("title", event?.title)} /></div>
      <div className="field"><label htmlFor="c-kind">ประเภท</label>
        <select id="c-kind" name="kind" defaultValue={v("kind", event?.kind ?? defaultKind ?? "appointment")}>
          {kinds.map((k) => <option key={k} value={k}>{KIND_TH[k]}</option>)}
        </select></div>
      <div className="field"><label htmlFor="c-status">สถานะ</label>
        <select id="c-status" name="status" defaultValue={v("status", event?.status ?? "planned")}>
          {(["planned", "in_progress", "done", "cancelled"] as const).map((s) => <option key={s} value={s}>{STATUS_TH[s]}</option>)}
        </select></div>
      <div className="field"><label htmlFor="c-start">วันที่เริ่ม *</label>
        <input id="c-start" name="startDate" type="date" required defaultValue={v("startDate", event?.start ?? defaultDate)} /></div>
      <div className="field"><label htmlFor="c-end">วันที่สิ้นสุด</label>
        <input id="c-end" name="endDate" type="date" defaultValue={v("endDate", event?.end ?? "")} />
        <small className="muted">เว้นว่าง = วันเดียว</small></div>
      <label className="check span-2"><input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> ทั้งวัน (ไม่ระบุเวลา)</label>
      {!allDay && (
        <>
          <div className="field"><label htmlFor="c-st">เวลาเริ่ม *</label>
            <input id="c-st" name="startTime" type="time" required defaultValue={v("startTime", event?.startTime ?? "09:00")} /></div>
          <div className="field"><label htmlFor="c-et">เวลาสิ้นสุด</label>
            <input id="c-et" name="endTime" type="time" defaultValue={v("endTime", event?.endTime ?? "10:00")} /></div>
        </>
      )}
      <div className="field"><label htmlFor="c-repeat">ทำซ้ำ</label>
        <select id="c-repeat" name="repeat" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
          {(["none", "daily", "weekly", "monthly"] as const).map((r) => <option key={r} value={r}>{REPEAT_TH[r]}</option>)}
        </select></div>
      {repeat !== "none" ? (
        <div className="field"><label htmlFor="c-until">ทำซ้ำถึงวันที่</label>
          <input id="c-until" name="repeatUntil" type="date" defaultValue={v("repeatUntil", event?.repeatUntil ?? "")} />
          <small className="muted">เว้นว่าง = ไม่มีกำหนด</small></div>
      ) : <div className="field form-spacer" aria-hidden="true" />}
      <div className="field"><label htmlFor="c-owner">ผู้รับผิดชอบ</label>
        <select id="c-owner" name="ownerId" defaultValue={v("ownerId", event ? event.ownerId ?? "" : me)}>
          <option value="">— ไม่ระบุ —</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select></div>
      <div className="field"><label htmlFor="c-remind">แจ้งเตือน</label>
        <select id="c-remind" name="remind" defaultValue={v("remind", event?.remindMinutes ?? "")}>
          <option value="">ไม่แจ้งเตือน</option>
          {REMIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select></div>
      <div className="field span-2"><label htmlFor="c-vis">ความเป็นส่วนตัว</label>
        <select id="c-vis" name="visibility" defaultValue={v("visibility", event?.visibility ?? "team")}>
          {(["team", "private", "executive"] as const).filter((x) => x !== "executive" || canExecutive || event?.visibility === "executive")
            .map((x) => <option key={x} value={x}>{VISIBILITY_TH[x]}{x === "team" ? " — ทุกคนในทีมเห็น" : x === "private" ? " — เฉพาะผู้สร้างและผู้รับผิดชอบ" : " — เฉพาะผู้บริหาร"}</option>)}
        </select></div>
      <div className="field span-2"><label htmlFor="c-details">รายละเอียด / หมายเหตุ</label>
        <textarea id="c-details" name="details" rows={3} maxLength={4000} defaultValue={v("details", event?.details)} /></div>
      <div className="field span-2"><label htmlFor="c-link">ลิงก์ไฟล์แนบ / เอกสาร</label>
        <input id="c-link" name="linkUrl" type="url" inputMode="url" placeholder="https://drive.google.com/…" defaultValue={v("linkUrl", event?.linkUrl)} />
        <small className="muted">รอบนี้แนบเป็นลิงก์ (Google Drive, Canva ฯลฯ)</small></div>
      {state.error && <p className="form-msg err span-2" role="alert">{state.error}</p>}
      {state.ok && <p className="form-msg ok span-2" role="status">{state.ok}</p>}
      {state.warn && <p className="form-msg warn span-2" role="status">⚠︎ {state.warn}</p>}
      <button className="btn span-2" type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : event ? "บันทึกการแก้ไข" : "เพิ่มรายการ"}</button>
    </form>
  );
}
