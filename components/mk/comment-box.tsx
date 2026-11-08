"use client";
import { useActionState, useState } from "react";
import { CircleAlert, RotateCcw, Send } from "lucide-react";
import { addComment } from "@/app/(mk)/mk/actions";
import type { FormState } from "@/app/actions";

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** Comment composer. The text is kept when sending fails; a retry reuses the same key, so the comment is never saved twice. */
export function CommentBox({ requestId, personId, label, placeholder, hint, id = "cmt", compact }: {
  requestId: string; personId?: string; label: string; placeholder: string; hint?: string; id?: string; compact?: boolean;
}) {
  const [text, setText] = useState("");
  const [key, setKey] = useState(newKey);
  const [state, act, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await addComment(prev, fd);
    if (r.ok) { setText(""); setKey(newKey()); }
    return r;
  }, {} as FormState);
  return (
    <form action={act} className="ap-compose" aria-busy={pending}>
      <input type="hidden" name="request_id" value={requestId} />
      {personId && <input type="hidden" name="person_id" value={personId} />}
      <input type="hidden" name="client_key" value={key} />
      <label htmlFor={id} className={compact ? "ap-note" : "sr-only"} style={compact ? { display: "block", margin: "0 0 6px", fontWeight: 600 } : undefined}>{label}</label>
      <div className="ap-compose-row">
        <textarea id={id} name="body" rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={2000}
          aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit(); }} />
        <button type="submit" className={`ap-ibtn ${text.trim() ? "primary" : "pinksoft"}`} aria-label={pending ? "กำลังส่งคอมเมนต์" : "ส่งคอมเมนต์"} disabled={pending || !text.trim()}>
          <Send aria-hidden="true" style={{ width: 20, height: 20 }} />
        </button>
      </div>
      {state.error && !pending ? (
        <div id={`${id}-err`} role="alert" className="ap-alert pill">
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><CircleAlert aria-hidden="true" />{state.error}</span>
          {text.trim() && <button type="submit"><RotateCcw aria-hidden="true" style={{ width: 15, height: 15 }} />ส่งอีกครั้ง</button>}
        </div>
      ) : hint ? <p id={`${id}-hint`} className="ap-note">{state.ok && !pending ? "ส่งคอมเมนต์แล้ว · " : ""}{hint}</p>
        : state.ok && !pending ? <p className="ap-note" role="status">ส่งคอมเมนต์แล้ว</p> : null}
    </form>
  );
}
