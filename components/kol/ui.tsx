/* eslint-disable @next/next/no-img-element -- images come from Postgres through our own routes (/api/kol/files, /api/public/hero) or local blob previews; next/image would need a custom loader */
import Link from "next/link";
import { ChevronLeft, Inbox, Database, Info } from "lucide-react";
import { PlatformIcon } from "./people";
export { KolPhoto, Net, PlatformIcon, Pill, SocialPair, mainSocial, type SocialLite } from "./people";
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
/** Page head per Master RCM §4: round back button, title + subtitle, optional counter pill; segmented tabs on the module's main pages. */
export function KolHead({ user, active, title, sub, pending, back, right, children }: {
  user: CurrentUser; active?: KolTab; title: React.ReactNode; sub?: string; pending?: number; back?: string; right?: React.ReactNode; children?: React.ReactNode;
}) {
  const tabs: { key: KolTab; href: string; label: string; count?: number }[] = can(user, "kol.view") ? [
    { key: "overview", href: "/kol", label: "ผู้สมัคร" },
    { key: "ceo", href: "/kol/ceo", label: "CEO อนุมัติ", count: pending },
    { key: "campaign", href: "/kol/campaign", label: "แคมเปญ" },
  ] : [];
  const showTabs = !!active && active !== "forms" && tabs.length > 1;
  return (
    <div className="k-head">
      <div className={`k-ph${back ? "" : " noback"}`}>
        {back && <Link href={back} className="k-back-btn" aria-label="ย้อนกลับ"><ChevronLeft aria-hidden="true" /></Link>}
        <div className="k-ph-t"><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
        {right ? <div>{right}</div> : <span />}
      </div>
      {showTabs && (
        <nav className="k-seg" aria-label="เมนู KOL">
          {tabs.map((t) => (
            <Link key={t.key} href={t.href} aria-current={t.key === active ? "page" : undefined}>
              {t.label}{t.count ? <span className="k-count" aria-label={`${t.count} รายการรอพิจารณา`}>{t.count}</span> : null}
            </Link>
          ))}
        </nav>
      )}
      {children}
    </div>
  );
}
