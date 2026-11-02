"use client";
import { useActionState } from "react";
import { changePassword, type FormState } from "@/app/actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  return (
    <form action={action} style={{ display: "grid", gap: 14, marginTop: 16 }}>
      <div className="field"><label htmlFor="current">รหัสผ่านปัจจุบัน</label><input id="current" name="current" type="password" autoComplete="current-password" required /></div>
      <div className="field"><label htmlFor="next">รหัสผ่านใหม่</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={12} required /></div>
      <div className="field"><label htmlFor="confirm">ยืนยันรหัสผ่านใหม่</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required /></div>
      {state.error && <p className="form-msg err" role="alert">{state.error}</p>}
      {state.ok && <p className="form-msg ok" role="status">{state.ok}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</button>
    </form>
  );
}
