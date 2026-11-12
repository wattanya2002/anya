import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ChevronRight, Link2, Search, SlidersHorizontal } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { bucketCounts, ceoCounts, filterOptions, kolReady, listApplicants } from "@/lib/kol";
import { getFormBySystemKey } from "@/lib/forms-server";
import { BUCKETS, SORTS, applicantRef, parseBucket, parseSort } from "@/lib/kol-core";
import { platformLabel } from "@/lib/forms-core";
import { Avatar, Empty, KolHead, SocialChips, StatusBadge, fmtDateTime, Note } from "@/components/kol/ui";
import { CopyButton } from "@/components/kol/client";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function KolOverview({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  if (!can(user, "kol.view")) redirect("/kol/forms");
  await kolReady(user);
  const sp = await searchParams;
  const bucket = parseBucket(one(sp.bucket));
  const sort = parseSort(one(sp.sort));
  const q = one(sp.q).trim().slice(0, 80);
  const platform = /^[a-z0-9_]{2,24}$/.test(one(sp.platform)) ? one(sp.platform) : null;
  const category = one(sp.category).slice(0, 60) || null;
  const [counts, ceo, opts, rows, form] = await Promise.all([
    bucketCounts(user.orgId), ceoCounts(user.orgId), filterOptions(user.orgId),
    listApplicants(user.orgId, { bucket, q, sort, platform, category }), getFormBySystemKey(user.orgId, "kol_application"),
  ]);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const publicUrl = form ? `${proto}://${host}/f/${form.slug}` : null;
  const filtered = !!(q || platform || category || sort !== "newest");
  const qs = (b: string) => { const u = new URLSearchParams(); if (b !== "all") u.set("bucket", b); if (q) u.set("q", q); if (platform) u.set("platform", platform); if (category) u.set("category", category); if (sort !== "newest") u.set("sort", sort); const s = u.toString(); return s ? `/kol?${s}` : "/kol"; };

  return (
    <>
      <KolHead user={user} active="overview" title="KOL Recruitment" sub="รับสมัคร คัดกรอง และเสนอ CEO" pending={ceo.pending} />
      {one(sp.erased) && <div style={{ marginTop: 12 }}><Note tone="ok">ลบข้อมูลส่วนบุคคลของผู้สมัครแล้ว</Note></div>}

      {publicUrl && can(user, "kol.review") && (
        <section className="k-card" style={{ marginTop: 14 }} aria-labelledby="share-h">
          <div className="k-row between">
            <div className="k-grow">
              <h2 id="share-h" style={{ margin: 0, fontSize: 15.5, display: "flex", alignItems: "center", gap: 8 }}><Link2 aria-hidden="true" style={{ width: 18, height: 18 }} />ลิงก์ฟอร์มสมัคร KOL สำหรับโพสต์ Facebook / Instagram / TikTok / LINE</h2>
              <p className="k-muted k-small k-ellipsis" style={{ margin: "6px 0 0" }}>{publicUrl}</p>
            </div>
            <div className="k-actions">
              <span className="k-badge" data-tone={form!.status === "published" ? "green" : "gray"}>{form!.status === "published" ? `เปิดรับสมัคร · v${form!.versionNo}` : "ปิดรับสมัคร"}</span>
              <CopyButton text={publicUrl} label="คัดลอกลิงก์" />
              <a className="k-btn sm" href={publicUrl} target="_blank" rel="noopener noreferrer">เปิดฟอร์ม</a>
            </div>
          </div>
        </section>
      )}

      <nav className="k-tiles" aria-label="สรุปผู้สมัคร (คำนวณจากข้อมูลจริง)">
        {BUCKETS.map((b) => (
          <Link key={b.key} href={qs(b.key)} className={`k-tile${b.key === "registered" ? " hl" : ""}`} aria-current={bucket === b.key ? "true" : undefined}>
            <b>{counts[b.key].toLocaleString("en-US")}</b><span>{b.label}</span>
          </Link>
        ))}
      </nav>

      <form className="k-card k-filters" role="search" action="/kol" style={{ marginTop: 14 }}>
        {bucket !== "all" && <input type="hidden" name="bucket" value={bucket} />}
        <label className="k-field"><span>ค้นหา</span>
          <input className="k-input" type="search" name="q" defaultValue={q} placeholder="ชื่อ, Creator, LINE, เบอร์, ลิงก์ หรือเลข KOL" enterKeyHint="search" maxLength={80} />
        </label>
        <label className="k-field"><span>ช่องทาง</span>
          <select className="k-select" name="platform" defaultValue={platform ?? ""}>
            <option value="">ทุกช่องทาง</option>{opts.platforms.map((p) => <option key={p} value={p}>{platformLabel(p)}</option>)}
          </select>
        </label>
        <label className="k-field"><span>ประเภทคอนเทนต์</span>
          <select className="k-select" name="category" defaultValue={category ?? ""}>
            <option value="">ทุกประเภท</option>{opts.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="k-field"><span>เรียงตาม</span>
          <select className="k-select" name="sort" defaultValue={sort}>{SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        </label>
        <div className="k-actions">
          <button type="submit" className="k-btn primary"><Search aria-hidden="true" />ค้นหา</button>
          {filtered && <Link href={bucket !== "all" ? `/kol?bucket=${bucket}` : "/kol"} className="k-btn ghost"><SlidersHorizontal aria-hidden="true" />ล้างตัวกรอง</Link>}
        </div>
      </form>

      <h2 className="sr-only">รายชื่อผู้สมัคร</h2>
      <p className="k-muted k-small" style={{ margin: "14px 4px 0" }} aria-live="polite">
        {BUCKETS.find((b) => b.key === bucket)?.label} · {rows.length.toLocaleString("en-US")} รายการ{rows.length >= 300 ? " (แสดง 300 รายการแรก)" : ""}
      </p>
      {rows.length === 0 ? (
        <div className="k-card" style={{ marginTop: 10 }}>
          <Empty title={counts.all === 0 ? "ยังไม่มีผู้สมัคร" : "ไม่พบผู้สมัครตามเงื่อนไข"} body={counts.all === 0 ? "เมื่อมีผู้ส่งใบสมัครผ่านลิงก์ฟอร์ม รายชื่อจะแสดงที่นี่ทันที" : "ลองเปลี่ยนคำค้นหรือตัวกรอง"} />
        </div>
      ) : (
        <ul className="k-list">
          {rows.map((a) => (
            <li key={a.id} className="k-item">
              <Avatar name={a.creatorName} fileId={a.photoFileId} />
              <div style={{ minWidth: 0 }}>
                <h3 className="k-row nowrap" style={{ gap: 8 }}>
                  {!a.firstViewedAt && a.status === "submitted" && <span className="k-new-dot" title="ยังไม่มีใครเปิดดู" aria-label="ใหม่" />}
                  <span className="k-ellipsis">{a.creatorName}</span>
                </h3>
                <div className="k-item-meta">
                  <span>{applicantRef(a.refNo)}</span><span className="k-ellipsis">{a.fullName}</span><span>สมัคร {fmtDateTime(a.createdAt)}</span>
                </div>
                {a.categories.length > 0 && <div className="k-chips" style={{ marginTop: 8 }}>{a.categories.map((c) => <span key={c} className="k-tag">{c}</span>)}</div>}
              </div>
              <div className="k-item-social"><SocialChips social={a.social} links={false} /></div>
              <div className="k-item-foot">
                <StatusBadge status={a.status} />
                <Link href={`/kol/applicants/${a.id}`} className="k-btn sm soft">ดูรายละเอียด<ChevronRight aria-hidden="true" /></Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
