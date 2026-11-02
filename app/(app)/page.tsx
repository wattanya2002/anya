import Link from "next/link";
import { Calendar, ChevronRight, Coins, Heart, LayoutGrid, Megaphone, SquareCheck, Star, Tag, Users } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { loadDashboard, type Kpi } from "@/lib/dashboard";
import { parseRange } from "@/lib/dates";
import { formatBahtFromSatang, formatInt, formatPct, formatThaiDateTime } from "@/lib/format";
import { NAV, SHORTCUTS } from "@/lib/nav";
import { NavIcon } from "@/components/nav-icon";
import { Delta } from "@/components/delta";
import { Donut, Sparkline, sliceColor } from "@/components/charts";
import { RangeSelect } from "@/components/range-select";
import { TaskList, AddTaskButton } from "@/components/tasks-today";

const TILE_TONE: Record<string, string> = {
  dashboard: "tone-pink", marketing: "tone-purple", content: "tone-green", promotion: "tone-amber",
  customers: "tone-pink", social: "tone-pink", inventory: "tone-blue", reports: "tone-pink",
};
const SOURCE_TH: Record<string, string> = { manual: "กรอกเอง", import: "ไฟล์นำเข้า", api: "API" };

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const range = parseRange((await searchParams).range);
  const d = await loadDashboard(user, range);
  const compare = `เทียบกับ ${range} วันก่อน`;
  const firstName = user.displayName;

  return (
    <>
      <section className="hero-row" aria-label="ภาพรวม">
        <div className="hero">
          {/* Provisional banner cropped from the user-approved master image; replace with the official photo when supplied. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero-img" src="/brand/hero-tennis.png" alt="" />
          <div className="hero-text">
            <p className="hero-greet">สวัสดี {firstName} <span aria-hidden="true">👋</span></p>
            <h1 className="hero-title">ภาพรวมธุรกิจ Wonder Courts</h1>
            <p className="hero-sub">จัดการคอร์ท การตลาด ลูกค้า และยอดขาย ได้ครบในที่เดียว</p>
          </div>
        </div>
        <div className="hero-side">
          <RangeSelect value={range} />
          <div className="freshness" aria-label="แหล่งข้อมูล">
            {d.sources.map((s) => (
              <div key={s.label}>
                <b>{s.label}:</b>{" "}
                {s.at ? `${SOURCE_TH[s.source ?? ""] ?? s.source} · ${formatThaiDateTime(s.at)}` : "ยังไม่มีข้อมูล"}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="kpis" aria-label="ตัวชี้วัดหลัก">
        <KpiCard icon={<Calendar />} tone="tone-pink" label="จำนวนการจอง" kpi={d.bookings} fmt={formatInt} sub={compare} />
        {d.revenueSatang === "forbidden" ? (
          <article className="card kpi">
            <span className="badge-icon tone-blue" aria-hidden="true"><Coins /></span>
            <div className="kpi-body"><div className="kpi-label">รายได้รวม</div><p className="locked">ไม่มีสิทธิ์ดูข้อมูลการเงิน</p></div>
          </article>
        ) : (
          <KpiCard icon={<Coins />} tone="tone-blue" label="รายได้รวม" kpi={d.revenueSatang} fmt={formatBahtFromSatang} sub={compare} />
        )}
        <KpiCard icon={<Users />} tone="tone-purple" label="ลูกค้าใหม่" kpi={d.newCustomers} fmt={formatInt} sub={compare} />
        <KpiCard icon={<Heart />} tone="tone-pink" label="อัตราการกลับมาใช้บริการ" kpi={d.returnRate} fmt={(n) => formatPct(n)} sub={compare} />
      </section>

      <section className="panels" aria-label="สรุปผล">
        <article className="card panel">
          <PanelHead icon={<Megaphone />} title="ผลการตลาด (Marketing)" sub="ภาพรวมแคมเปญและช่องทางการตลาด" href={NAV.marketing.href} />
          {d.marketing === "forbidden" ? (
            <div className="empty-state"><strong>ไม่มีสิทธิ์ดูข้อมูลการตลาด</strong></div>
          ) : !d.marketing.hasData ? (
            <div className="empty-state">
              <strong>ยังไม่มีข้อมูลโซเชียล</strong>
              <span>บันทึกหรือนำเข้ายอด Reach / คลิก รายแพลตฟอร์มเพื่อเริ่มติดตาม</span>
              <Link href={NAV.social.href}>ไปที่ Social KPI</Link>
            </div>
          ) : (
            <>
              <div className="mk-stats">
                <div className="mk-stat">
                  <div className="mk-label" title={d.marketing.reachPlatform ? `Reach ของ ${d.marketing.reachPlatform} รวมรายวัน (ไม่ใช่จำนวนคนไม่ซ้ำ และไม่รวมข้ามแพลตฟอร์ม)` : undefined}>
                    ยอดเข้าชม (Reach){d.marketing.reachPlatform ? <small> · {d.marketing.reachPlatform}</small> : null}
                    <span className="sr-only"> รวมรายวัน ไม่ใช่จำนวนคนไม่ซ้ำ</span>
                  </div>
                  <div className="mk-line">
                    <span className="mk-value">{d.marketing.reach.value === null ? "—" : formatInt(d.marketing.reach.value)}</span>
                    <Delta value={d.marketing.reach.delta} unit="pct" />
                  </div>
                </div>
                <div className="mk-stat">
                  <div className="mk-label">ยอดคลิก (Click)</div>
                  <div className="mk-line">
                    <span className="mk-value">{d.marketing.clicks.value === null ? "—" : formatInt(d.marketing.clicks.value)}</span>
                    <Delta value={d.marketing.clicks.delta} unit="pct" />
                  </div>
                </div>
              </div>
              <div className="mk-conv">
                <div className="mk-conv-text">
                  <div className="mk-label">อัตราแปลงเป็นการจอง</div>
                  <div className="mk-line">
                    <span className="mk-value">{formatPct(d.marketing.conversion.value)}</span>
                    <Delta value={d.marketing.conversion.delta} unit="pt" />
                  </div>
                </div>
                <Sparkline values={d.marketing.series} label={`แนวโน้มยอดคลิกรายวัน ${range} วัน`} />
              </div>
            </>
          )}
        </article>

        <article className="card panel">
          <PanelHead icon={<Calendar />} title="สรุปการจองสนาม" sub="จำนวนการจองตามประเภทสนาม" href={NAV.courts.href} />
          {!d.courts.configured ? (
            <div className="empty-state">
              <strong>ยังไม่ได้ตั้งค่าประเภทสนาม</strong>
              <span>เพิ่มประเภทสนามและนำเข้ารายการจองจากระบบจองเดิม</span>
              <Link href={NAV.courts.href}>ตั้งค่าสนาม</Link>
            </div>
          ) : (
            <div className="donut-wrap">
              <Donut slices={d.courts.slices} total={d.courts.total} />
              <ul className="legend">
                {d.courts.slices.map((s) => (
                  <li key={s.name}>
                    <i style={{ background: sliceColor(s.color) }} aria-hidden="true" />
                    <span>{s.name}</span>
                    <b>{d.courts.total > 0 ? `${Math.round(s.pct)}%` : "—"}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>

        <article className="card panel panel-promo">
          <PanelHead icon={<Tag />} title="สรุปโปรโมชั่น" sub="ประสิทธิภาพของโปรโมชั่นที่กำลังใช้งาน" href={NAV.promotion.href} />
          {d.promotion === "forbidden" ? (
            <div className="empty-state"><strong>ไม่มีสิทธิ์ดูโปรโมชั่น</strong></div>
          ) : d.promotion === null ? (
            <div className="empty-state">
              <strong>ยังไม่มีโปรโมชั่นที่กำลังใช้งาน</strong>
              <span>โปรโมชั่นจะแสดงที่นี่หลังได้รับอนุมัติและเริ่มใช้งาน</span>
              <Link href={NAV.promotion.href}>ไปที่ Promotion</Link>
            </div>
          ) : (
            <>
              <div className="promo-hero">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="promo-thumb" src={d.promotion.coverImagePath ?? "/brand/promo-tennis.png"} alt="" />
                <div className="promo-name">{d.promotion.name}</div>
                <span className="status-pill">กำลังใช้งาน</span>
              </div>
              <div className="promo-stats">
                <div><span>จำนวนการใช้</span><b>{formatInt(d.promotion.uses)}</b></div>
                <div><span>รายได้ที่เกิดจากโปรฯ</span><b>{d.promotion.revenueSatang === null ? "—" : formatBahtFromSatang(d.promotion.revenueSatang)}</b></div>
                <div>
                  <span>ผลตอบรับ</span>
                  <b title={`${d.promotion.ratingCount} รีวิว`}>
                    {d.promotion.rating === null ? "N/A" : d.promotion.rating.toFixed(1)}
                    {d.promotion.rating !== null && <Star aria-hidden="true" />}
                  </b>
                </div>
              </div>
            </>
          )}
        </article>
      </section>

      <section className="lower">
        <article className="card tasks" aria-labelledby="tasks-title">
          <div className="panel-head">
            <span className="badge-icon tone-pink" aria-hidden="true"><SquareCheck /></span>
            <div className="panel-head-text">
              <h2 className="panel-title" id="tasks-title">งานวันนี้ <small>({d.tasks.length} รายการ)</small></h2>
            </div>
            <div className="head-actions">
              {can(user, "tasks.manage") && <AddTaskButton />}
              <Link className="more" href={NAV.settings.href} aria-label="ดูงานและการอนุมัติทั้งหมด"><ChevronRight aria-hidden="true" /></Link>
            </div>
          </div>
          <TaskList tasks={d.tasks} canManage={can(user, "tasks.manage")} />
        </article>

        <article className="card shortcuts" aria-labelledby="shortcuts-title">
          <div className="panel-head">
            <span className="badge-icon tone-pink" aria-hidden="true"><LayoutGrid /></span>
            <h2 className="panel-title" id="shortcuts-title">ทางลัดไปยังโมดูล</h2>
            <span className="shortcuts-note">จัดการทุกส่วนของ Wonder Courts</span>
          </div>
          <nav className="tiles" aria-label="ทางลัดไปยังโมดูล">
            {SHORTCUTS.map((k) => (
              <Link key={k} href={NAV[k].href} className="tile">
                <span className={`badge-icon ${TILE_TONE[k]}`} aria-hidden="true"><NavIcon k={k} /></span>
                <div>
                  <div className="tile-name">{NAV[k].label}</div>
                  <div className="tile-sub">{NAV[k].sub}</div>
                </div>
              </Link>
            ))}
          </nav>
        </article>
      </section>
    </>
  );
}

function PanelHead({ icon, title, sub, href }: { icon: React.ReactNode; title: string; sub: string; href: string }) {
  return (
    <div className="panel-head">
      <span className="badge-icon tone-pink" aria-hidden="true">{icon}</span>
      <div className="panel-head-text">
        <h2 className="panel-title">{title}</h2>
        <p className="panel-sub">{sub}</p>
      </div>
      <Link className="more" href={href} aria-label={`ดูเพิ่มเติม: ${title}`}><ChevronRight aria-hidden="true" /></Link>
    </div>
  );
}

function KpiCard({ icon, tone, label, kpi, fmt, sub }: {
  icon: React.ReactNode; tone: string; label: string; kpi: Kpi; fmt: (n: number) => string; sub: string;
}) {
  return (
    <article className="card kpi">
      <span className={`badge-icon ${tone}`} aria-hidden="true">{icon}</span>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        {kpi.value === null ? (
          <>
            <div className="kpi-line"><span className="kpi-value empty">ยังไม่มีข้อมูล</span></div>
            <div className="kpi-sub">รอนำเข้าข้อมูลการจอง</div>
          </>
        ) : (
          <>
            <div className="kpi-line">
              <span className="kpi-value">{fmt(kpi.value)}</span>
              <Delta value={kpi.delta} unit={kpi.deltaUnit} />
            </div>
            <div className="kpi-sub">{sub}</div>
          </>
        )}
      </div>
    </article>
  );
}
