"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle } from "lucide-react";

/** Notification card that opens / closes when tapped (canvas 05, comment “กดที่การ์ดเพื่อเปิด/ซ่อน”). */
export function NotifCard({ type, head, title, status, defaultOpen, caps, extra, composer, ack, approve, footer, startWithComposer }: {
  type: "due" | "comment" | "new"; head: React.ReactNode; title: string; status: React.ReactNode; defaultOpen: boolean;
  caps: React.ReactNode; extra?: React.ReactNode; composer: React.ReactNode; ack: React.ReactNode; approve?: React.ReactNode; footer: React.ReactNode; startWithComposer?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [compose, setCompose] = useState(!!startWithComposer);
  return (
    <article className="ap-ncard" data-t={type}>
      <button type="button" className="ap-ncard-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {head}
        <span className="ap-ncard-title">
          <b>{title}</b>{status}
          {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </span>
        <span className="sr-only">{open ? "แตะเพื่อซ่อนรายละเอียด" : "แตะเพื่อเปิดรายละเอียด"}</span>
      </button>
      {open && (
        <>
          <button type="button" className="ap-caps" onClick={() => setOpen(false)} aria-label="ซ่อนรายละเอียด" style={{ width: "100%", border: 0, textAlign: "left", cursor: "pointer" }}>{caps}</button>
          {extra}
          {compose && <div className="ap-nlast" style={{ borderStyle: extra ? "dashed" : undefined }}>{composer}</div>}
          <div className="ap-nbtns">
            {ack}
            <button type="button" className={`ap-btn h44 ${compose ? "pinksoft" : ""}`} aria-pressed={compose} onClick={() => setCompose((c) => !c)}>
              <MessageCircle aria-hidden="true" />คอมเมนต์
            </button>
            {approve}
          </div>
          {footer}
        </>
      )}
    </article>
  );
}
