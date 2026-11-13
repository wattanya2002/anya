import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ChevronDown, Clock3, ExternalLink, FileText, Link2, Megaphone, Search, SlidersHorizontal, Users } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { bucketCounts, ceoCounts, filterOptions, kolReady, listApplicants } from "@/lib/kol";
import { getFormBySystemKey } from "@/lib/forms-server";
import { BUCKETS, SORTS, applicantRef, parseBucket, parseSort } from "@/lib/kol-core";
import { platformLabel } from "@/lib/forms-core";
import { Empty, KolHead, KolPhoto, PlatformIcon, SocialPair, StatusBadge, Note } from "@/components/kol/ui";
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

  const reviewer = can(user, "kol.review");
  const second = reviewer ? BUCKETS.find((b) => b.key === "review")! : BUCKETS.find((b) => b.key === "pending_ceo")!;
  const activeFilters = [q, platform, category, bucket !== "all" ? bucket : "", sort !== "newest" ? sort : ""].filter(Boolean).length;

  return (
    <>
      <KolHead user={user} active="overview" title="KOL Recruitment" sub="รับสมัคร คัดกรอง และเสนอ CEO" pending={ceo.pending} back="/" />
      {one(sp.erased) && <div style={{ marginTop: 18 }}><Note tone="ok">ลบข้อมูลส่วนบุคคลของผู้สมัครแล้ว</Note></div>}

      <nav className="k-stat2" aria-label="สรุปผู้สมัคร (คำนวณจากข้อมูลจริง)" style={{ marginTop: 22 }}>
        <Link href={qs("all")} aria-current={bucket === "all" && !filtered ? "true" : undefined}>
          <i aria-hidden="true"><Users /></i><span>ผู้สมัครทั้งหมด<b>{counts.all.toLocaleString("en-US")}</b></span>
        </Link>
        <Link href={qs(second.key)} aria-current={bucket === second.key ? "true" : undefined}>
          <i aria-hidden="true"><Clock3 /></i><span>{second.label}<b>{counts[second.key].toLocaleString("en-US")}</b></span>
        </Link>
      </nav>

      {publicUrl && reviewer && (
        <section className="k-card" style={{ marginTop: 18 }} aria-labelledby="share-h">
          <div className="k-row between" style={{ alignItems: "flex-start" }}>
            <div className="k-grow">
              <h2 id="share-h" style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}><Link2 aria-hidden="true" style={{ width: 19, height: 19 }} />ลิงก์ฟอร์มสมัคร KOL</h2>
              <p className="k-muted k-small k-ellipsis" style={{ margin: "6px 0 0" }}>{publicUrl}</p>
            </div>
            <span className="k-badge" data-tone={form!.status === "published" ? "green" : "gray"}>{form!.status === "published" ? `เปิดรับสมัคร · v${form!.versionNo}` : "ปิดรับสมัคร"}</span>
          </div>
          <div className="k-actions" style={{ marginTop: 18 }}>
            <CopyButton text={publicUrl} label="คัดลอกลิงก์" />
            <a className="k-btn sm" href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />เปิดฟอร์ม</a>
            {(can(user, "forms.manage") || can(user, "forms.responses")) && <Link className="k-ibtn" style={{ width: 44, height: 44 }} href="/kol/forms" aria-label="จัดการฟอร์ม (Form Builder)" title="จัดการฟอร์ม (Form Builder)"><FileText aria-hidden="true" /></Link>}
          </div>
        </section>
      )}

      <details className="k-fp" style={{ marginTop: 18 }} open={activeFilters > 0 && rows.length === 0}>
        <summary><Search aria-hidden="true" />ค้นหา &amp; กรอง{activeFilters > 0 && <span className="k-fp-n">ใช้ตัวกรอง {activeFilters} รายการ</span>}<ChevronDown className="chev" aria-hidden="true" style={activeFilters > 0 ? { marginLeft: 8 } : { marginLeft: "auto" }} /></summary>
        <form className="k-fp-body" role="search" action="/kol">
          <div>
            <label className="k-search"><span className="sr-only">ค้นหา</span><Search aria-hidden="true" />
              <input className="k-input" type="search" name="q" defaultValue={q} placeholder="ค้นหาชื่อครีเอเตอร์, รหัส KOL, LINE, เบอร์ หรือลิงก์" enterKeyHint="search" maxLength={80} />
            </label>
          </div>
          <div>
            <h3 id="f-platform">ช่องทาง</h3>
            <div className="k-radio-chips" role="radiogroup" aria-labelledby="f-platform">
              <label><input type="radio" name="platform" value="" defaultChecked={!platform} /><span>All</span></label>
              {opts.platforms.map((p) => (
                <label key={p}><input type="radio" name="platform" value={p} defaultChecked={platform === p} /><span><PlatformIcon platform={p} />{platformLabel(p)}</span></label>
              ))}
            </div>
          </div>
          <div>
            <label className="k-field"><h3>ประเภทคอนเทนต์</h3>
              <select className="k-select" name="category" defaultValue={category ?? ""}><option value="">ทั้งหมด</option>{opts.categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </label>
          </div>
          <div>
            <label className="k-field"><h3>สถานะ</h3>
              <select className="k-select" name="bucket" defaultValue={bucket === "all" ? "" : bucket}>
                <option value="">ทั้งหมด</option>{BUCKETS.filter((b) => b.key !== "all").map((b) => <option key={b.key} value={b.key}>{b.label} ({counts[b.key].toLocaleString("en-US")})</option>)}
              </select>
            </label>
          </div>
          <div>
            <label className="k-field"><h3>เรียงตาม</h3>
              <select className="k-select" name="sort" defaultValue={sort}>{SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
            </label>
          </div>
          <div className="k-fp-actions">
            <Link href="/kol" className="k-btn pinksoft"><SlidersHorizontal aria-hidden="true" />ล้างตัวกรอง</Link>
            <button type="submit" className="k-btn primary"><Search aria-hidden="true" />ค้นหา</button>
          </div>
        </form>
      </details>

      <h2 className="sr-only">รายชื่อผู้สมัคร</h2>
      <p className="k-muted k-small" style={{ margin: "14px 4px 10px" }} aria-live="polite">
        {BUCKETS.find((b) => b.key === bucket)?.label} · {rows.length.toLocaleString("en-US")} รายการ{rows.length >= 300 ? " (แสดง 300 รายการแรก)" : ""}
      </p>
      {rows.length === 0 ? (
        <div className="k-card">
          <Empty title={counts.all === 0 ? "ยังไม่มีผู้สมัคร" : "ไม่พบผู้สมัครตามเงื่อนไข"} body={counts.all === 0 ? "เมื่อมีผู้ส่งใบสมัครผ่านลิงก์ฟอร์ม รายชื่อจะแสดงที่นี่ทันที" : "ลองเปลี่ยนคำค้นหรือตัวกรอง"} />
          {counts.all > 0 && <div style={{ display: "flex", justifyContent: "center" }}><Link href="/kol" className="k-btn pinksoft">กลับหน้ารายการ</Link></div>}
        </div>
      ) : (
        <ul className="k-cards">
          {rows.map((a) => (
            <li key={a.id}>
              <Link href={`/kol/applicants/${a.id}`} className="k-app" aria-label={`${a.creatorName} ${applicantRef(a.refNo)} — ดูรายละเอียด`}>
                <KolPhoto name={a.creatorName} fileId={a.photoFileId} />
                <div style={{ minWidth: 0 }}>
                  <div className="k-app-top">
                    <h3 className="k-app-name">
                      {!a.firstViewedAt && a.status === "submitted" && <span className="k-new" title="ยังไม่มีใครเปิดดู" aria-label="ใหม่" />}
                      <b>{a.creatorName}</b><span className="k-code">{applicantRef(a.refNo)}</span>
                    </h3>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="k-app-cat"><Megaphone aria-hidden="true" /><span>{a.categories.join(" • ") || a.fullName}</span></div>
                  <SocialPair social={a.social} handle={false} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
