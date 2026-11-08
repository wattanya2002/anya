import Link from "next/link";
import {
  Bell, CalendarDays, Clock, FileText, Inbox, Megaphone, Tag, Users, LayoutGrid, Play, Camera, Video, Globe, CircleUserRound,
} from "lucide-react";
import { KIND_LABEL, STATUS_LABEL, dueLabel, baht, initialsOf, thaiShort, type MkKind, type MkPlatform, type MkStatus } from "@/lib/mk-core";
import type { RequestRow } from "@/lib/mk";

export type MkSection = "req" | "cal" | "inf" | "notif" | null;

/** The MK shell: one screen tall, only the inner area scrolls. */
export function Screen({ children, tone, label }: { children: React.ReactNode; tone?: "white" | "gray" | "form"; label?: string }) {
  return (
    <div className="ap" data-tone={tone} aria-label={label}>
      {children}
    </div>
  );
}

export function Brand() {
  return <Link href="/" className="ap-brand">Wonder Courts · การตลาด</Link>;
}

export function Head({ title, sub, right, pb40 }: { title: string; sub?: React.ReactNode; right?: React.ReactNode; pb40?: boolean }) {
  return (
    <header className={`ap-head${pb40 ? " pb40" : ""}`}>
      <div className="ap-col">
        <div className="ap-head-row">
          <Brand />
          {right && <div className="ap-head-right">{right}</div>}
        </div>
        <h1>{title}</h1>
        {sub && <div className="ap-head-sub">{sub}</div>}
      </div>
    </header>
  );
}

export function Panel({ children, soft, bar, id }: { children: React.ReactNode; soft?: boolean; bar?: boolean; id?: string }) {
  return (
    <main id={id ?? "main"} className={`ap-panel${soft ? " soft" : ""}${bar ? " bar" : ""}`}>
      <div className="ap-col">{children}</div>
    </main>
  );
}

export function MkNav({ active, unread }: { active: MkSection; unread: number }) {
  const items: { k: Exclude<MkSection, null>; label: string; href: string; icon: React.ReactNode }[] = [
    { k: "req", label: "คำขอ", href: "/mk", icon: <Inbox aria-hidden="true" /> },
    { k: "cal", label: "ปฏิทิน", href: "/mk/calendar", icon: <CalendarDays aria-hidden="true" /> },
    { k: "inf", label: "อินฟลู", href: "/mk/influencers", icon: <Users aria-hidden="true" /> },
    { k: "notif", label: "แจ้งเตือน", href: "/mk/notifications", icon: <Bell aria-hidden="true" /> },
  ];
  return (
    <nav className="ap-nav" aria-label="เมนู MK">
      {items.map((i) => (
        <Link key={i.k} href={i.href} aria-current={active === i.k ? "page" : undefined}
          aria-label={i.k === "notif" && unread ? `แจ้งเตือน ยังไม่อ่าน ${unread} รายการ` : undefined}>
          {i.icon}<span>{i.label}</span>
          {i.k === "notif" && unread > 0 && <span className="ap-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function BellLink({ unread }: { unread: number }) {
  return (
    <Link href="/mk/notifications" className="ap-ibtn" aria-label={unread ? `แจ้งเตือน ยังไม่อ่าน ${unread} รายการ` : "แจ้งเตือน"}>
      <Bell aria-hidden="true" strokeWidth={1.8} />
      {unread > 0 && <span className="ap-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}

export function StatusPill({ status, className }: { status: MkStatus; className?: string }) {
  return <span className={`ap-pill${className ? ` ${className}` : ""}`} data-s={status}>{STATUS_LABEL[status]}</span>;
}

export function KindIcon({ kind }: { kind: MkKind | "all" }) {
  switch (kind) {
    case "ad": return <Megaphone aria-hidden="true" strokeWidth={1.8} />;
    case "influencer": return <Users aria-hidden="true" strokeWidth={1.8} />;
    case "promotion": return <Tag aria-hidden="true" strokeWidth={1.8} />;
    case "other": return <FileText aria-hidden="true" strokeWidth={1.8} />;
    default: return <LayoutGrid aria-hidden="true" strokeWidth={1.8} />;
  }
}

export function Tile({ kind, size = 44 }: { kind: MkKind | "all"; size?: number }) {
  return <span className="ap-tile" data-k={kind} style={{ ["--s" as string]: `${size}px` }}><KindIcon kind={kind} /></span>;
}

export function PlatformIcon({ p }: { p: MkPlatform }) {
  switch (p) {
    case "tiktok": return <Play aria-hidden="true" strokeWidth={1.8} />;
    case "instagram": return <Camera aria-hidden="true" strokeWidth={1.8} />;
    case "youtube": return <Video aria-hidden="true" strokeWidth={1.8} />;
    case "facebook": return <CircleUserRound aria-hidden="true" strokeWidth={1.8} />;
    default: return <Globe aria-hidden="true" strokeWidth={1.8} />;
  }
}

/** What the row says next to the due date: budget, discount or total fee. */
export function rowMeta(r: Pick<RequestRow, "kind" | "amountSatang" | "discountText">): string | null {
  if (r.kind === "promotion" && r.discountText) return r.discountText;
  if (r.amountSatang === null) return null;
  return `${r.kind === "influencer" ? "ค่าจ้างรวม" : "งบ"} ${baht(r.amountSatang)}`;
}

export function ReqRow({ r, today, showStatus = true }: { r: RequestRow; today: string; showStatus?: boolean }) {
  const due = dueLabel(r.decideBy, today);
  const meta = rowMeta(r);
  const urgent = r.status === "pending" && (r.urgent || due.urgent);
  return (
    <li>
      <Link href={`/mk/requests/${r.id}`} className="ap-row">
        <Tile kind={r.kind} />
        <span className="ap-row-text">
          <span className="ap-row-kind">{KIND_LABEL[r.kind]}{r.kind === "influencer" && r.peopleCount ? ` · ${r.peopleCount} คน` : ""}</span>
          <span className="ap-row-title">{r.title}</span>
          <span className="ap-row-meta">
            {meta && <><span>{meta}</span><span aria-hidden="true">·</span></>}
            {r.status === "pending"
              ? (urgent ? <span className="urgent"><Clock aria-hidden="true" strokeWidth={2} />{r.urgent && !due.urgent ? `ด่วน · ${due.text}` : due.text}</span> : <span>{due.text}</span>)
              : <span>กำหนด {thaiShort(r.decideBy)}</span>}
            {r.commentCount > 0 && <><span aria-hidden="true">·</span><span>{r.commentCount} คอมเมนต์</span></>}
          </span>
        </span>
        {showStatus && <StatusPill status={r.status} />}
      </Link>
    </li>
  );
}

export function Empty({ icon, tone, title, children, action }: { icon: React.ReactNode; tone?: "blue" | "red"; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="ap-empty" role="status">
      <span className={`ap-empty-ic${tone ? ` ${tone}` : ""}`}>{icon}</span>
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Avatar({ name, me }: { name: string; me?: boolean }) {
  return <span className={`ap-av${me ? " me" : ""}`} aria-hidden="true">{me ? "คุณ" : initialsOf(name)}</span>;
}

/** Toast shown once after a redirect (?saved=1, ?done=…). Purely presentational; it fades on its own. */
export function Toast({ title, sub, tone }: { title: string; sub?: string; tone?: "amber" }) {
  return (
    <div className={`ap-toast${tone ? ` ${tone}` : ""}`} role="status">
      <span aria-hidden="true">{tone === "amber" ? "↺" : "✓"}</span>
      <p><b>{title}</b>{sub && <small>{sub}</small>}</p>
    </div>
  );
}
