"use client";
import { useActionState } from "react";
import { saveSupplier } from "@/app/(app)/inventory/actions";
import type { FormState } from "@/app/actions";
import type { Supplier } from "@/lib/inventory";

export function SupplierForm({ supplier }: { supplier: Supplier | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSupplier, {});
  const f = state.fields;
  const v = (k: string, fb: string | number | null | undefined) => (f && k in f ? f[k] : fb ?? "") as string;
  return (
    <form action={action} className="form-grid" key={supplier ? supplier.id : state.nonce ?? "new"}>
      {supplier && <input type="hidden" name="id" value={supplier.id} />}
      <div className="field span-2"><label htmlFor="s-name">ชื่อร้าน/บริษัท *</label><input id="s-name" name="name" required maxLength={120} defaultValue={v("name", supplier?.name)} /></div>
      <div className="field"><label htmlFor="s-contact">ผู้ติดต่อ</label><input id="s-contact" name="contactName" maxLength={80} defaultValue={v("contactName", supplier?.contactName)} /></div>
      <div className="field"><label htmlFor="s-phone">เบอร์โทร</label><input id="s-phone" name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="08x-xxx-xxxx" defaultValue={v("phone", supplier?.phone)} /></div>
      <div className="field span-2"><label htmlFor="s-line">LINE (ลิงก์ หรือ ID)</label><input id="s-line" name="line" placeholder="https://lin.ee/… หรือ @ไอดีร้าน หรือ ไอดีส่วนตัว" defaultValue={v("line", supplier?.lineUrl)} />
        <small className="muted">ใช้ทำปุ่ม “LINE” กดเปิดแชทได้ทันที</small></div>
      <div className="field"><label htmlFor="s-lead">ระยะเวลารอของ (วัน)</label><input id="s-lead" name="leadTimeDays" type="number" inputMode="numeric" min={0} max={365} step={1} defaultValue={v("leadTimeDays", supplier?.leadTimeDays)} /></div>
      <div className="field span-2"><label htmlFor="s-note">หมายเหตุ (วันส่งของ, ขั้นต่ำการสั่ง ฯลฯ)</label><input id="s-note" name="note" maxLength={500} defaultValue={v("note", supplier?.note)} /></div>
      {supplier && <label className="check span-2"><input type="checkbox" name="isActive" defaultChecked={supplier.isActive} /> ยังติดต่อใช้งานอยู่</label>}
      {state.error && <p className="form-msg err span-2" role="alert">{state.error}</p>}
      {state.ok && <p className="form-msg ok span-2" role="status">{state.ok}</p>}
      <button className="btn span-2" type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : supplier ? "บันทึกการแก้ไข" : "เพิ่มซัพพลายเออร์"}</button>
    </form>
  );
}
