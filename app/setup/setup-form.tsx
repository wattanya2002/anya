"use client";
import { useActionState } from "react";
import { completeSetup } from "./actions";
import type { FormState } from "@/app/actions";

export function SetupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(completeSetup, {});
  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <div className="field"><label htmlFor="token">รหัสตั้งค่า (Setup token)</label><input id="token" name="token" type="password" autoComplete="off" required /></div>
      <div className="field"><label htmlFor="org">ชื่อธุรกิจ</label><input id="org" name="org" defaultValue={state.fields?.org ?? "Wonder Courts"} required maxLength={120} /></div>
      <div className="field"><label htmlFor="name">ชื่อที่แสดง</label><input id="name" name="name" defaultValue={state.fields?.name} required maxLength={80} /></div>
      <div className="field"><label htmlFor="email">อีเมล</label><input id="email" name="email" type="email" autoComplete="username" defaultValue={state.fields?.email} required /></div>
      <div className="field"><label htmlFor="password">รหัสผ่าน (อย่างน้อย 12 ตัวอักษร)</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required /></div>
      <div className="field"><label htmlFor="mustChange"><input id="mustChange" name="mustChange" type="checkbox" defaultChecked /> บังคับเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบ (รหัสชั่วคราว)</label></div>
      {state.error && <p className="form-msg err" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "กำลังสร้าง…" : "สร้างบัญชีผู้ดูแลระบบ"}</button>
    </form>
  );
}
