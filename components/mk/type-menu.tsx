"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Filter } from "lucide-react";

export type TypeOption = { key: string; label: string; href: string; current: boolean; tile: React.ReactNode };

/** Overview "ประเภทคำขอ" menu: icon-only trigger, capsule options over a soft veil (approved canvas 01b). */
export function TypeMenu({ options, active, activeLabel }: { options: TypeOption[]; active: boolean; activeLabel: string | null }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="ap-typemenu">
      <button ref={btn} type="button" className={`ap-ficon${active ? " on" : ""}`} aria-haspopup="menu" aria-expanded={open}
        aria-label={activeLabel ? `กรองตามประเภท: ${activeLabel}` : "กรองตามประเภทคำขอ"} title="ประเภทคำขอ" onClick={() => setOpen((o) => !o)}
        style={open ? { position: "relative", zIndex: 21 } : undefined}>
        <Filter aria-hidden="true" strokeWidth={1.8} />
      </button>
      {open && (
        <>
          <button type="button" className="ap-typemenu-veil" aria-label="ปิดเมนูประเภท" onClick={() => setOpen(false)} style={{ border: 0 }} />
          <div className="ap-typemenu-list" role="menu" aria-label="ประเภทคำขอ">
            <div>ประเภทคำขอ</div>
            {options.map((o, i) => (
              <Link key={o.key} role="menuitem" href={o.href} aria-current={o.current ? "true" : "false"} onClick={() => setOpen(false)} autoFocus={i === 0}>
                {o.tile}<span>{o.label}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
