"use client";
import { useActionState, useId, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Copy, Loader2, MessageCircle, RotateCcw, Send } from "lucide-react";
import type { FormState } from "@/app/actions";
import { lineShareUrl, registrationMessage } from "@/lib/kol-core";
import { revealLink } from "@/app/(app)/kol/actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export async function copyText(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* fallback below */ }
  const ta = document.createElement("textarea");
  ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { return document.execCommand("copy"); } finally { ta.remove(); }
}

export function CopyButton({ text, label = "คัดลอก", className = "k-btn sm soft" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={className} onClick={async () => { setDone(await copyText(text)); setTimeout(() => setDone(false), 2500); }}>
      {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}<span aria-live="polite">{done ? "คัดลอกแล้ว" : label}</span>
    </button>
  );
}

/** Message box for text the team sends themselves (the system does not send LINE messages). */
export function MessageOut({ text }: { text: string }) {
  const isUrl = /^https?:\/\/\S+$/.test(text.trim());
  return (
    <div>
      <div className="k-msgbox">{text}</div>
      <div className="k-actions" style={{ marginTop: 8 }}>
        <CopyButton text={text} label={isUrl ? "คัดลอกลิงก์" : "คัดลอกข้อความ"} />
        {!isUrl && <a className="k-btn sm sky" href={lineShareUrl(text)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />เปิด LINE เพื่อส่งเอง</a>}
      </div>
    </div>
  );
}

/** Decrypts an applicant link on demand (team only) and copies it — or the ready LINE message for STEP 2 links. */
export function RevealCopy({ tokenId, purpose, name, expiresAt }: { tokenId: string; purpose: "status" | "registration"; name: string; expiresAt: string }) {
  const [state, setState] = useState<{ url?: string; error?: string; busy?: boolean; copied?: "link" | "msg" }>({});
  async function get() {
    if (state.url) return state.url;
    setState({ busy: true });
    const r = await revealLink(tokenId);
    setState({ url: r.url, error: r.error });
    return r.url;
  }
  const msg = state.url && purpose === "registration" ? registrationMessage({ name, url: state.url, expiresAt: new Date(expiresAt) }) : null;
  return (
    <div>
      <div className="k-actions">
        <button type="button" className="k-btn sm soft" disabled={state.busy} onClick={async () => { const u = await get(); if (u && (await copyText(u))) setState((s) => ({ ...s, url: u, copied: "link" })); }}>
          {state.copied === "link" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{state.copied === "link" ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์"}
        </button>
        {purpose === "registration" && (
          <button type="button" className="k-btn sm sky" disabled={state.busy} onClick={async () => {
            const u = await get(); if (!u) return;
            const m = registrationMessage({ name, url: u, expiresAt: new Date(expiresAt) });
            if (await copyText(m)) setState((s) => ({ ...s, url: u, copied: "msg" }));
          }}>
            {state.copied === "msg" ? <Check aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}{state.copied === "msg" ? "คัดลอกข้อความแล้ว" : "คัดลอกข้อความส่ง LINE"}
          </button>
        )}
        {msg && <a className="k-btn sm ghost" href={lineShareUrl(msg)} target="_blank" rel="noopener noreferrer">เปิด LINE</a>}
      </div>
      {state.error && <p className="k-alert err" role="alert" style={{ marginTop: 8 }}><AlertCircle aria-hidden="true" />{state.error}</p>}
    </div>
  );
}

type Confirm = { title: string; body: string; confirmLabel: string; tone?: "danger" | "primary" };

/** A server-action form with inline result, optional in-app confirmation dialog (no browser alert), and double-submit protection. */
export function ActionForm({ action, children, submitLabel, submitClass = "k-btn primary", confirm, resetOnOk, className, hideSubmit, footer, id, inline }: {
  action: Action; children?: React.ReactNode; submitLabel: React.ReactNode; submitClass?: string; confirm?: Confirm; resetOnOk?: boolean;
  className?: string; hideSubmit?: boolean; footer?: React.ReactNode; id?: string; inline?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [state, act, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await action(prev, fd);
    if (confirmRef.current) confirmRef.current.value = "";
    if (r.ok && resetOnOk) formRef.current?.reset();
    return r;
  }, {} as FormState);
  return (
    <form ref={formRef} action={act} className={className} aria-busy={pending} id={id} noValidate
      style={inline ? { display: "inline-flex", flexDirection: "column", gap: 6, maxWidth: "100%" } : undefined}
      onSubmit={(e) => { if (confirm && confirmRef.current?.value !== "yes") { e.preventDefault(); dlg.current?.showModal(); } }}>
      {confirm && <input ref={confirmRef} type="hidden" name="confirm" defaultValue="" />}
      {children}
      {state.error && <p className="k-alert err" role="alert" style={{ marginTop: inline ? 0 : 10 }}><AlertCircle aria-hidden="true" />{state.error}</p>}
      {state.ok && !pending && !inline && <p className="k-alert ok" role="status" style={{ marginTop: 10 }}><CheckCircle2 aria-hidden="true" />{state.ok}</p>}
      {state.warn && !pending && <MessageOut text={state.warn} />}
      {!hideSubmit && (
        <div className="k-actions" style={inline ? { order: -1 } : { marginTop: 12 }}>
          <button type="submit" className={submitClass} disabled={pending}>{pending ? <><Loader2 className="spin" aria-hidden="true" />กำลังบันทึก…</> : submitLabel}</button>
          {footer}
        </div>
      )}
      {confirm && (
        <dialog ref={dlg} className="k-dialog" aria-labelledby={`${id ?? "c"}-dlg-t`}>
          <div className="k-dialog-body">
            <h2 id={`${id ?? "c"}-dlg-t`}>{confirm.title}</h2>
            <p>{confirm.body}</p>
            <div className="k-actions end">
              <button type="button" className="k-btn" onClick={() => dlg.current?.close()}>ยกเลิก</button>
              <button type="button" className={`k-btn ${confirm.tone === "danger" ? "danger-solid" : "primary"}`}
                onClick={() => { if (confirmRef.current) confirmRef.current.value = "yes"; dlg.current?.close(); formRef.current?.requestSubmit(); }}>{confirm.confirmLabel}</button>
            </div>
          </div>
        </dialog>
      )}
    </form>
  );
}

/** Comment / note composer. Text is kept if sending fails; a retry reuses the same key so nothing is saved twice. */
export function ComposeBox({ action, hidden, placeholder, label, privateNote }: { action: Action; hidden: Record<string, string>; placeholder: string; label: string; privateNote?: string }) {
  const [text, setText] = useState("");
  const [key, setKey] = useState("");
  const [state, act, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.ok) { setText(""); setKey(""); }
    return r;
  }, {} as FormState);
  const id = useId();
  return (
    <form action={act} aria-busy={pending}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="client_key" value={key} />
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="k-compose">
        <textarea id={id} name="body" className="k-textarea" rows={1} value={text} maxLength={2000} placeholder={placeholder}
          onChange={(e) => { setText(e.target.value); if (!key) setKey(newKey()); }} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit(); }} />
        <button type="submit" className="k-btn primary" style={{ minHeight: 48, padding: "0 14px" }} disabled={pending || !text.trim()} aria-label={pending ? "กำลังส่ง" : "ส่ง"}>
          {pending ? <Loader2 className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
        </button>
      </div>
      {state.error && !pending && (
        <p className="k-alert err" role="alert" style={{ marginTop: 8 }}><AlertCircle aria-hidden="true" />{state.error}
          {text.trim() && <button type="submit" className="k-btn sm white" style={{ marginLeft: "auto" }}><RotateCcw aria-hidden="true" />ส่งอีกครั้ง</button>}</p>
      )}
      {state.ok && !pending && <p className="k-private" role="status"><Check aria-hidden="true" />{state.ok}</p>}
      {privateNote && <p className="k-private">{privateNote}</p>}
    </form>
  );
}
