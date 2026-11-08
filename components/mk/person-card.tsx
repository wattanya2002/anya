import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { PLATFORM_LABEL, baht, compactCount } from "@/lib/mk-core";
import type { Person } from "@/lib/mk";
import { PlatformIcon, StatusPill } from "./ui";

/** Two-column influencer card (approved canvas 03, comment “ทำเป็น 2 คอลัมน์”). */
export function PersonCard({ p, href }: { p: Person; href: string }) {
  return (
    <li>
      <Link href={href} className="ap-pcard">
        <span className="ap-pphoto">
          {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied https photo of any host */}
          {p.photoUrl ? <img src={p.photoUrl} alt="" className="ap-img" loading="lazy" referrerPolicy="no-referrer" /> : <span className="ap-ph"><Users aria-hidden="true" strokeWidth={1.2} /></span>}
          <StatusPill status={p.status === "approved" ? "approved" : "pending"} className="sm" />
        </span>
        <span className="ap-pcard-body">
          <b>{p.name}</b>
          <span className="ap-pcard-plat"><PlatformIcon p={p.platform} />{PLATFORM_LABEL[p.platform]}{p.followers !== null ? ` · ${compactCount(p.followers)}` : ""}</span>
          {p.feeSatang !== null && <span className="ap-pcard-fee">{baht(p.feeSatang)}</span>}
          <span className="ap-pcard-meta">{[p.avgViews !== null ? `วิว ${compactCount(p.avgViews)}` : null, p.deliverables].filter(Boolean).join(" · ")}</span>
          <span className="ap-pcard-cta"><span>ดูรายละเอียด<ChevronRight aria-hidden="true" /></span></span>
        </span>
      </Link>
    </li>
  );
}
