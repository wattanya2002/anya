"use client";
import { useActionState } from "react";
import { signIn, type FormState } from "@/app/actions";

export function SignInForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <div className="field">
        <label htmlFor="email">อีเมล</label>
        <input id="email" name="email" type="email" autoComplete="username" inputMode="email" required defaultValue={state.fields?.email} />
      </div>
      <div className="field">
        <label htmlFor="password">รหัสผ่าน</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && <p className="form-msg err" role="alert">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
    </form>
  );
}
