/* eslint-disable @next/next/no-img-element -- images come from Postgres through our own route (/api/kol/files); next/image would need a custom loader */
/* Presentational pieces shared by server pages and client components (no server imports here). */
import { Camera, Globe, MessageCircle, Music2, Play, Users } from "lucide-react";
import { compactNumber, initials, socialHandle } from "@/lib/kol-core";
import { platformLabel } from "@/lib/forms-core";

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

/** Counter pill: "1 / 8" or "8 รายการ". */
export function Pill({ children, label }: { children: React.ReactNode; label?: string }) {
  return <span className="k-pill" aria-label={label}>{children}</span>;
}

/** Square (or round) profile photo uploaded by the applicant; initials on a soft background when there is none. */
export function KolPhoto({ name, fileId, round = false, size, large = false }: { name: string; fileId: string | null; round?: boolean; size?: number; large?: boolean }) {
  return (
    <span className={`k-photo${round ? " round" : ""}${large ? " lg" : ""}`} style={size ? ({ "--s": `${size}px` } as React.CSSProperties) : undefined} aria-hidden="true">
      {fileId ? <img src={`/api/kol/files/${fileId}`} alt="" loading="lazy" /> : initials(name)}
    </span>
  );
}

export type SocialLite = { platform: string; url: string | null; followers: number | null };
const ORDER = ["instagram", "tiktok", "youtube", "facebook"];
/** The two main channels (Instagram, TikTok first), the way the master card shows them. */
export function mainSocial(social: SocialLite[]): SocialLite[] {
  return social.slice().sort((a, b) => {
    const ia = ORDER.indexOf(a.platform), ib = ORDER.indexOf(b.platform);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (b.followers ?? -1) - (a.followers ?? -1);
  }).slice(0, 2);
}
export function Net({ s, handle = true }: { s: SocialLite; handle?: boolean }) {
  const h = handle ? socialHandle(s.url) : null;
  const followers = s.followers === null ? "ไม่ระบุผู้ติดตาม" : `ผู้ติดตาม ${compactNumber(s.followers)}`;
  return (
    <span className="k-net">
      <span className="k-net-ic" data-p={s.platform}><PlatformIcon platform={s.platform} /></span>
      {handle
        ? <span>{h ? <><b>{h}</b><small>{followers}</small></> : <><b>{platformLabel(s.platform)}</b><small>{followers}</small></>}</span>
        : <span><span className="sr-only">{platformLabel(s.platform)} </span><b>{followers}</b></span>}
    </span>
  );
}
/** IG | TikTok pair with a thin divider. */
export function SocialPair({ social, handle = true }: { social: SocialLite[]; handle?: boolean }) {
  const two = mainSocial(social);
  if (!two.length) return <div className="k-pair one"><span className="k-muted k-small">ไม่มีข้อมูล Social Media</span></div>;
  return (
    <div className={`k-pair${two.length === 1 ? " one" : ""}`}>
      <Net s={two[0]} handle={handle} />
      {two[1] && <><i aria-hidden="true" /><Net s={two[1]} handle={handle} /></>}
    </div>
  );
}
