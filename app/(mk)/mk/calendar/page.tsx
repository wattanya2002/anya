import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { bangkokToday } from "@/lib/dates";
import { isIsoDate } from "@/lib/calendar-core";
import { calendarMonth, requestsDueOn, unreadCount, mkViewer } from "@/lib/mk";
import { WEEKDAYS_SUN, monthCells, monthLong, promoBars, shiftMonth, thaiRange, thaiShort, weekdayLong, type PromoSpan } from "@/lib/mk-core";
import { BellLink, Empty, Head, MkNav, Panel, ReqRow, Screen } from "@/components/mk/ui";

export const metadata = { title: "ปฏิทิน · MK" };

const ROW = 52;
const LANE = 8;

function promoHref(p: PromoSpan) {
  return p.key.startsWith("req:") ? `/mk/requests/${p.key.slice(4)}` : "/calendar";
}

export default async function MkCalendar({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await mkViewer();
  const today = bangkokToday();
  const day = isIsoDate(sp.d) ? sp.d : today;
  const month = isIsoDate(sp.m) ? `${sp.m.slice(0, 7)}-01` : `${day.slice(0, 7)}-01`;
  const selected = day.slice(0, 7) === month.slice(0, 7) ? day : null;
  const [{ dots, promos }, dayItems, unread] = await Promise.all([
    calendarMonth(user, month),
    selected ? requestsDueOn(user, selected) : Promise.resolve([]),
    unreadCount(user),
  ]);
  const weeks = monthCells(month);
  const dayPromos = selected ? promos.filter((p) => p.start <= selected && p.end >= selected) : [];
  const q = (m: string, d?: string) => `/mk/calendar?m=${m}${d ? `&d=${d}` : ""}`;
  const prev = shiftMonth(month, -1), next = shiftMonth(month, 1);

  return (
    <Screen>
      <Head title="ปฏิทิน" pb40 right={<BellLink unread={unread} />} />
      <Panel>
        <div className="ap-mhead">
          <h2>{monthLong(month)}</h2>
          <div className="ap-mnav">
            <Link href={q(prev)} scroll={false} aria-label={`เดือนก่อนหน้า ${monthLong(prev)}`}><ChevronLeft aria-hidden="true" /></Link>
            <i aria-hidden="true" />
            <Link href={q(next)} scroll={false} aria-label={`เดือนถัดไป ${monthLong(next)}`}><ChevronRight aria-hidden="true" /></Link>
          </div>
        </div>
        {month.slice(0, 7) !== today.slice(0, 7) && (
          <Link href={q(`${today.slice(0, 7)}-01`, today)} scroll={false} className="ap-link" style={{ minHeight: 36 }}><CalendarDays aria-hidden="true" />กลับไปวันนี้</Link>
        )}
        <div className="ap-wd" aria-hidden="true">{WEEKDAYS_SUN.map((d) => <span key={d}>{d}</span>)}</div>
        <div role="grid" aria-label={`ปฏิทิน ${monthLong(month)}`}>
          {weeks.map((wk, wi) => {
            const bars = promoBars(wk, promos);
            const lanes = bars.length ? Math.max(...bars.map((b) => b.lane)) + 1 : 0;
            return (
              <div role="row" key={wi} className="ap-week" style={{ height: ROW + (lanes ? lanes * LANE + 2 : 0) }}>
                {wk.map((d, ci) => {
                  if (!d) return <span key={ci} role="gridcell" />;
                  const n = dots[d] ?? 0;
                  const label = `${thaiShort(d, true)}${d === today ? " วันนี้" : ""}${n ? ` มีคำขอครบกำหนด ${n} รายการ` : ""}`;
                  return (
                    <span role="gridcell" key={d}>
                      <Link href={q(month, d)} scroll={false} className={`ap-day${d === today ? " today" : ""}`} aria-label={label} aria-current={d === selected ? "date" : undefined}>
                        <span className="ap-dnum">{Number(d.slice(8, 10))}</span>
                        <span className="ap-dots" aria-hidden="true">{Array.from({ length: Math.min(n, 3) }, (_, i) => <i key={i} />)}</span>
                      </Link>
                    </span>
                  );
                })}
                {bars.map((b) => (
                  <span key={b.key} className="ap-pbar" aria-hidden="true" title={b.name} style={{
                    top: ROW - 2 + b.lane * LANE, background: b.color,
                    left: `calc(${b.col} * 100% / 7 + ${b.startsHere ? 4 : 0}px)`,
                    width: `calc(${b.span} * 100% / 7 - ${(b.startsHere ? 4 : 0) + (b.endsHere ? 4 : 0)}px)`,
                    borderRadius: `${b.startsHere ? 3 : 0}px ${b.endsHere ? 3 : 0}px ${b.endsHere ? 3 : 0}px ${b.startsHere ? 3 : 0}px`,
                  }} />
                ))}
              </div>
            );
          })}
        </div>
        <div className="ap-legend">
          <span><i style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid var(--ap-ink)" }} />วันนี้</span>
          <span><i style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--ap-pinkd)" }} />วันที่เลือก</span>
          <span><i style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ap-pink)" }} />มีคำขอครบกำหนด</span>
          {promos.length > 0 && <span><i style={{ width: 14, height: 5, borderRadius: 3, background: "#6fa9dc" }} />ช่วงโปรโมชัน</span>}
        </div>
        {promos.length > 0 && <>
          <div className="ap-label" style={{ marginTop: 10, fontSize: 12.5 }}>โปรโมชันเดือนนี้ · {promos.length} รายการ</div>
          <div className="ap-promos">
            {promos.map((p) => (
              <Link key={p.key} href={promoHref(p)}><i style={{ background: p.color }} aria-hidden="true" /><b>{p.name}</b><small>{thaiRange(p.start, p.end)}</small></Link>
            ))}
          </div>
        </>}

        {selected && <>
          <div className="ap-dayhead">
            <h2>{weekdayLong(selected)} {thaiShort(selected)}</h2>
            <span>{dayItems.length} คำขอ{dayPromos.length ? ` · ${dayPromos.length} โปรโมชัน` : ""}</span>
          </div>
          {dayItems.length > 0
            ? <ul className="ap-rows">{dayItems.map((r) => <ReqRow key={r.id} r={r} today={today} />)}</ul>
            : <Empty icon={<CalendarDays aria-hidden="true" />} tone="blue" title="ไม่มีคำขอครบกำหนดวันนี้">{dayPromos.length ? "มีโปรโมชันที่กำลังใช้อยู่ด้านบน" : "เลือกวันที่มีจุดสีชมพูเพื่อดูคำขอ"}</Empty>}
          {dayPromos.length > 0 && (
            <div className="ap-promos" style={{ marginTop: 8 }} aria-label="โปรโมชันในวันนี้">
              {dayPromos.map((p) => <Link key={p.key} href={promoHref(p)}><i style={{ background: p.color }} aria-hidden="true" /><b>{p.name}</b><small>{thaiRange(p.start, p.end)}</small></Link>)}
            </div>
          )}
        </>}
      </Panel>
      <MkNav active="cal" unread={unread} />
    </Screen>
  );
}
