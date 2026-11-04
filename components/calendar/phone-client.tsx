"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { setTaskDone } from "@/app/actions";

export type PickerItem = { href: string; label: string; current?: boolean; badge?: number; divider?: boolean };

/** Pill view switcher (RCM v1.1 UI-G07): รายวัน / รายเดือน, plus filter, weekly summary and "today". */
export function ViewPicker({ label, showLabel, items }: { label: string; showLabel: boolean; items: PickerItem[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="vp" ref={root}>
      <button type="button" className={`vp-btn${showLabel ? " with-label" : ""}`} aria-expanded={open} aria-controls={id} aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}>
        <span className="vp-face"><CalendarDays aria-hidden="true" className="vp-ic" /><span className={showLabel ? "vp-label" : "sr-only"}>{label}</span></span>
        <ChevronDown aria-hidden="true" className="vp-chev" />
      </button>
      {open && (
        <ul className="vp-menu" id={id}>
          {items.map((it) => (
            <li key={it.label} className={it.divider ? "div" : undefined}>
              <Link href={it.href} aria-current={it.current ? "page" : undefined} onClick={() => setOpen(false)}>
                <span>{it.label}</span>
                {it.current && <Check aria-hidden="true" />}
                {it.badge ? <b>{it.badge}</b> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Horizontal swipe on the week strip moves one week (DAY-03); links stay available for keyboard users. */
export function SwipeWeek({ prev, next, children }: { prev: string; next: string; children: React.ReactNode }) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <div className="pd-swipe"
      onTouchStart={(e) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const s = start.current; start.current = null;
        if (!s) return;
        const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) router.push(dx < 0 ? next : prev, { scroll: false });
      }}>
      <Link className="pd-week-link prev" href={prev} scroll={false}>สัปดาห์ก่อนหน้า</Link>
      {children}
      <Link className="pd-week-link next" href={next} scroll={false}>สัปดาห์ถัดไป</Link>
    </div>
  );
}

/** Escape closes an open bottom sheet (§7.2). */
export function SheetEscape({ closeHref }: { closeHref: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.push(closeHref, { scroll: false }); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeHref, router]);
  return null;
}

/** Mark-done check on task cards only (DAY-07). */
export function TaskDoneButton({ taskId, done, title }: { taskId: string; done: boolean; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <button type="button" className={`pd-check${done ? " on" : ""}`} aria-pressed={done} disabled={pending}
      aria-label={done ? `ยกเลิกเสร็จ: ${title}` : `ทำเครื่องหมายเสร็จ: ${title}`} title={error ?? undefined}
      onClick={() => start(async () => {
        const r = await setTaskDone(taskId, !done);
        if (r.error) setError(r.error); else router.refresh();
      })}>
      <Check aria-hidden="true" />
    </button>
  );
}
