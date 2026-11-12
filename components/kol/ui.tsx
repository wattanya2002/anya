/* eslint-disable @next/next/no-img-element -- images come from Postgres through our own routes (/api/kol/files, /api/public/hero) or local blob previews; next/image would need a custom loader */
import Link from "next/link";
import { Camera, ClipboardCheck, FileText, Globe, Inbox, Megaphone, MessageCircle, Music2, Play, Users, Database, Info } from "lucide-react";
import { STATUS_LABEL, STATUS_TONE, compactNumber, initials, type ApplicantStatus } from "@/lib/kol-core";
import { platformLabel } from "@/lib/forms-core";
import type { CurrentUser } from "@/lib/auth";
import { can } from "@/lib/auth";

export function StatusBadge({ status }: { status: ApplicantStatus }) {
  return <span className="k-badge" data-tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</span>;
}

export function Avatar({ name, fileId, size = "" }: { name: string; fileId: string | null; size?: "" | "lg" | "sm" }) {
  return (
    <span className={`k-av ${size}`} aria-hidden="true">
      {fileId ? <img src={`/api/kol/files/${fileId}`} alt="" loading="lazy" /> : initials(name)}
    </span>
  );
}

export function PlatformIcon({ platform }: { platform: string }) {
  const p = { "aria-hidden": true as const };
  switch (platform) {
    case "instagram": return <Camera {...p} />;
    case "tiktok": return <Music2 {...p} />;
    case "youtube": return <Play {...p} />;
    case "facebook": return <Users {...p} />;
    case "line": return <MessageCircle {...p} />;
    default: return <Globe {...p} />;
  }
}

export function SocialChips({ social, links = true }: { social: { platform: string; url: string | null; followers: number | null }[]; links?: boolean }) {
  if (!social.length) return <span className="k-muted k-small">ไม่มีข้อมูล Social Media</span>;
  return (
    <div className="k-social">
      {social.map((s) => {
        const inner = <><PlatformIcon platform={s.platform} />{platformLabel(s.platform)} <b>{compactNumber(s.followers)}</b></>;
        return links && s.url
          ? <a key={s.platform} className="k-soc" href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`${platformLabel(s.platform)} ${s.followers ?? "ไม่ระบุ"} ผู้ติดตาม (เปิดโปรไฟล์)`}>{inner}</a>
          : <span key={s.platform} className="k-soc">{inner}</span>;
      })}
    </div>
  );
}

export function SourceNote({ children }: { children: React.ReactNode }) {
  return <span className="k-source"><Database aria-hidden="true" />{children}</span>;
}
export function Empty({ title, body, icon }: { title: string; body?: string; icon?: React.ReactNode }) {
  return <div className="k-empty">{icon ?? <Inbox aria-hidden="true" />}<b>{title}</b>{body && <span>{body}</span>}</div>;
}
export function Note({ tone = "", children }: { tone?: "" | "warn" | "ok" | "err"; children: React.ReactNode }) {
  return <div className={`k-alert ${tone}`}><Info aria-hidden="true" /><div>{children}</div></div>;
}

const dtf = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const df = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (d: Date | string | null | undefined) => (d ? dtf.format(new Date(d)) : "–");
export const fmtDate = (d: Date | string | null | undefined) => (d ? df.format(typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00+07:00`) : new Date(d)) : "–");

export type KolTab = "overview" | "ceo" | "campaign" | "forms";
export function KolHead({ user, active, title, sub, pending, children }: {
  user: CurrentUser; active: KolTab; title: string; sub?: string; pending?: number; children?: React.ReactNode;
}) {
  const tabs: { key: KolTab; href: string; label: string; icon: React.ReactNode; show: boolean; count?: number }[] = [
    { key: "overview", href: "/kol", label: "ผู้สมัคร", icon: <Megaphone aria-hidden="true" />, show: can(user, "kol.view") },
    { key: "ceo", href: "/kol/ceo", label: "CEO อนุมัติ", icon: <ClipboardCheck aria-hidden="true" />, show: can(user, "kol.view"), count: pending },
    { key: "campaign", href: "/kol/campaign", label: "แคมเปญ", icon: <Users aria-hidden="true" />, show: can(user, "kol.view") },
    { key: "forms", href: "/kol/forms", label: "ฟอร์ม", icon: <FileText aria-hidden="true" />, show: can(user, "forms.manage") || can(user, "forms.responses") },
  ];
  return (
    <div className="k-head">
      <h1 className="k-title"><span className="k-ic" aria-hidden="true"><Megaphone /></span><span>{title}{sub && <><br /><small>{sub}</small></>}</span></h1>
      <nav className="k-subnav" aria-label="เมนู KOL">
        {tabs.filter((t) => t.show).map((t) => (
          <Link key={t.key} href={t.href} aria-current={t.key === active ? "page" : undefined}>
            {t.icon}{t.label}{t.count ? <span className="k-count" aria-label={`${t.count} รายการรอพิจารณา`}>{t.count}</span> : null}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
