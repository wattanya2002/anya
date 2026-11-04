/** iPhone Day and Month views — Calendar RCM v1.1 (MASTER_DAY_REFERENCE / MASTER_MONTH_REFERENCE).
 *  Rendered next to the desktop views; CSS shows these below 768px only. */
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  KIND_TH, KIND_TONE, STATUS_TH, WEEKDAY_TH, addDays, addMonths, diffDays, itemsOn, monthStart, monthTitle, monthWeeks, thaiDate,
  thaiSpokenDate, weekStart, type CalItem,
} from "@/lib/calendar-core";
import { THEMES, holidayKey, holidaysOn, isDayOff, type Holiday } from "@/lib/holidays-th";
import { HolidayIcon } from "./holiday-icon";
import { KindIcon } from "./kind-icon";
import { SwipeWeek, TaskDoneButton } from "./phone-client";
import type { Href } from "./screen";

const holVars = (h: Holiday) => ({ ["--hb" as string]: THEMES[h.theme].bg, ["--hf" as string]: THEMES[h.theme].fg, ["--hd" as string]: THEMES[h.theme].dot });

/** Minutes since midnight in Asia/Bangkok. */
function bangkokMinutes(now = new Date()): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(now).split(":").map(Number);
  return (h % 24) * 60 + m;
}
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Short secondary line for a card: manual details, or what the source item is about. */
function describe(i: CalItem, day: string): string | null {
  const multi = i.start !== i.end;
  const range = multi ? `${thaiDate(i.start)} – ${thaiDate(i.end)}` : null;
  const milestone = multi ? (day === i.start ? "เริ่มวันนี้" : day === i.end ? "วันสุดท้าย" : "กำลังใช้งาน") : null;
  const first = i.details?.split("\n").find((l) => l.trim())?.trim() ?? null;
  return [milestone, range, first].filter(Boolean).join(" · ") || null;
}

// ---------------------------------------------------------------- Day
export function PhoneDay({ items, hols, date, today, href, manage, selectedKey, canTasks }: {
  items: CalItem[]; hols: Holiday[]; date: string; today: string; href: Href; manage: boolean; selectedKey: string; canTasks: boolean;
}) {
  const ws = weekStart(date);
  const strip = Array.from({ length: 7 }, (_, k) => addDays(ws, k));
  const on = itemsOn(items, date);
  const dayHols = holidaysOn(hols, date);
  const allDay = on.filter((i) => !i.startTime || i.start !== i.end);
  const timed = on.filter((i) => i.startTime && i.start === i.end).sort((a, b) => a.startTime!.localeCompare(b.startTime!) || a.key.localeCompare(b.key));
  // Highlight: the tapped item; otherwise, today, the event happening now or next (master: filled marker + pink card).
  let focus = selectedKey ? on.find((i) => i.sourceKey === selectedKey)?.key ?? null : null;
  if (!focus && date === today) {
    const now = bangkokMinutes();
    const live = timed.filter((i) => i.status !== "done" && i.status !== "cancelled");
    focus = (live.find((i) => mins(i.startTime!) <= now && now < (i.endTime ? mins(i.endTime) : mins(i.startTime!) + 60)) ?? live.find((i) => mins(i.startTime!) > now))?.key ?? null;
  }
  const empty = !allDay.length && !timed.length && !dayHols.length;
  return (
    <section className="pd" aria-label={`กิจกรรม${thaiSpokenDate(date)}`}>
      <SwipeWeek prev={href({ view: "day", date: addDays(date, -7) })} next={href({ view: "day", date: addDays(date, 7) })}>
        <nav className="pd-strip" aria-label="เลือกวันในสัปดาห์">
          {strip.map((d, k) => {
            const dayItems = itemsOn(items, d);
            const tones = [...new Set(dayItems.filter((i) => i.start === d).map((i) => KIND_TONE[i.kind]))].slice(0, 3);
            const hs = holidaysOn(hols, d);
            return (
              <Link key={d} href={href({ view: "day", date: d })} scroll={false} aria-current={d === date ? "date" : undefined}
                aria-label={`${thaiSpokenDate(d)}, ${dayItems.length + hs.length} กิจกรรม`}
                className={`${d === date ? "sel" : ""}${d === today ? " today" : ""}${isDayOff(hs) ? " off" : ""}`} style={hs[0] ? holVars(hs[0]) : undefined}>
                <span className="pd-wd">{WEEKDAY_TH[k]}</span>
                <b className="pd-num">{Number(d.slice(8))}</b>
                <span className="pd-dots" aria-hidden="true">
                  {tones.map((t) => <i key={t} className={`k-${t}`} />)}
                  {!tones.length && hs[0] && <i style={{ background: THEMES[hs[0].theme].dot }} />}
                </span>
              </Link>
            );
          })}
        </nav>
      </SwipeWeek>

      <div className="pd-scroll">
        {empty ? (
          <div className="pd-empty">
            <p>ยังไม่มีกิจกรรมในวันนี้</p>
            {manage && <Link className="btn-pill primary" href={href({ new: "1" })}><Plus aria-hidden="true" />เพิ่มรายการ</Link>}
          </div>
        ) : (
          <ol className="pd-tl">
            {dayHols.map((h) => (
              <li key={holidayKey(h)} className="pd-row compact">
                <span className="pd-marker" aria-hidden="true" />
                <div className="pd-card hol compact" style={holVars(h)}>
                  <Link className="pd-link" href={href({ holiday: holidayKey(h), date })} scroll={false}>
                    <span className="pd-ic"><HolidayIcon theme={h.theme} /></span>
                    <span className="pd-main">
                      <span className="pd-title">{h.name}</span>
                      <span className="pd-desc">{h.off && !h.pending ? "วันหยุด" : h.type === "festival" ? "เทศกาล" : "วันสำคัญ"} · สี{THEMES[h.theme].colorTh}</span>
                    </span>
                    <span className="pd-time">ทั้งวัน</span>
                  </Link>
                </div>
              </li>
            ))}
            {allDay.map((i) => <DayCard key={i.key} i={i} date={date} href={href} focused={focus === i.key} canTasks={canTasks} compact />)}
            {timed.map((i) => <DayCard key={i.key} i={i} date={date} href={href} focused={focus === i.key} canTasks={canTasks} />)}
          </ol>
        )}
      </div>

      {manage && (
        <Link className="pd-fab" href={href({ new: "1" })} aria-label={`เพิ่มรายการวันที่ ${thaiDate(date)}`}><Plus aria-hidden="true" /></Link>
      )}
    </section>
  );
}

function DayCard({ i, date, href, focused, canTasks, compact = false }: { i: CalItem; date: string; href: Href; focused: boolean; canTasks: boolean; compact?: boolean }) {
  const desc = describe(i, date);
  const taskId = i.source === "task" ? i.sourceKey.slice(5) : null;
  const showStatus = i.status === "pending_approval" || i.status === "overdue" || i.status === "cancelled";
  return (
    <li className={`pd-row${focused ? " focus" : ""}${compact ? " compact" : ""}`}>
      <span className="pd-marker" aria-hidden="true" />
      <div className={`pd-card k-${KIND_TONE[i.kind]} st-${i.status}${focused ? " focus" : ""}${compact ? " compact" : ""}`}>
        <Link className="pd-link" href={href({ item: i.sourceKey, date })} scroll={false} aria-current={focused ? "true" : undefined}>
          <span className="pd-ic"><KindIcon kind={i.kind} /></span>
          <span className="pd-main">
            <span className="pd-title">{i.title}</span>
            {desc && <span className="pd-desc">{desc}</span>}
            <span className="pd-tags">
              <span className="pd-badge">{KIND_TH[i.kind]}</span>
              {showStatus && <span className={`cal-status st-${i.status}`}>{STATUS_TH[i.status]}</span>}
            </span>
          </span>
          <span className="pd-time">{i.startTime && i.start === i.end ? `${i.startTime} น.` : "ทั้งวัน"}</span>
        </Link>
        {taskId && canTasks && <TaskDoneButton taskId={taskId} done={i.status === "done"} title={i.title} />}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- Month
const RANK = (i: CalItem, d: string) =>
  (i.kind === "promotion" || i.kind === "campaign") && i.start === d ? 0 : i.source === "task" || i.status === "overdue" ? 1 : i.startTime ? 2 : 3;
/** Month chip label for a holiday: drop the leading "วัน" and anything after " · ". */
const holShort = (h: Holiday) => { const n = h.name.split(" · ")[0]; return n.startsWith("วัน") && n.length > 5 ? n.slice(3) : n; };

export function PhoneMonth({ items, hols, date, today, href }: { items: CalItem[]; hols: Holiday[]; date: string; today: string; href: Href }) {
  const weeks = monthWeeks(date);
  const month = date.slice(0, 7);
  const prev = addMonths(date, -1), next = addMonths(date, 1); // clamps 31 → last day (MON-02)
  return (
    <section className="pm" aria-label={`ปฏิทินเดือน${monthTitle(date)}`}>
      <div className="pm-nav">
        <Link className="pm-arrow" href={href({ view: "month", date: prev })} scroll={false} aria-label={`เดือนก่อนหน้า: ${monthTitle(monthStart(prev))}`}><ChevronLeft aria-hidden="true" /></Link>
        <h2 aria-live="polite">{monthTitle(date)}</h2>
        <Link className="pm-arrow" href={href({ view: "month", date: next })} scroll={false} aria-label={`เดือนถัดไป: ${monthTitle(monthStart(next))}`}><ChevronRight aria-hidden="true" /></Link>
      </div>
      <div className="pm-wd" aria-hidden="true">{WEEKDAY_TH.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="pm-grid" style={{ ["--rows" as string]: weeks.length }}>
        {weeks.flat().map((d) => {
          const on = itemsOn(items, d);
          const starts = on.filter((i) => i.start === d).sort((a, b) => RANK(a, d) - RANK(b, d) || (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));
          const ongoing = on.filter((i) => i.start < d);
          const hs = holidaysOn(hols, d);
          const chips: { key: string; label: string; tone?: string; kind?: CalItem["kind"]; hol?: Holiday }[] = [
            ...starts.map((i) => ({ key: i.key, label: i.shortTitle || i.title, tone: KIND_TONE[i.kind], kind: i.kind })),
            ...hs.map((h) => ({ key: holidayKey(h), label: holShort(h), hol: h })),
          ];
          const shown = chips.slice(0, 1);
          const more = chips.length - shown.length;
          // Short ranges (≤ 7 days) continue as a soft dot on each following day (MON-08); long campaigns
          // keep only their start chip so the month does not fill with markers. Every day keeps the full aria label.
          const dots = [...new Set(ongoing.filter((i) => diffDays(i.start, i.end) <= 6).map((i) => KIND_TONE[i.kind]))].slice(0, 3);
          const label = `${thaiSpokenDate(d)}, ${on.length + hs.length} กิจกรรม${on.length + hs.length ? `: ${[...on.map((i) => i.start !== i.end ? `${i.title} ${thaiDate(i.start)} ถึง ${thaiDate(i.end)}` : i.title), ...hs.map((h) => h.name)].join(", ")}` : ""}`;
          return (
            <Link key={d} href={href({ view: "month", date: d })} scroll={false} aria-label={label} aria-current={d === date ? "date" : undefined}
              className={`pm-cell${d.slice(0, 7) !== month ? " out" : ""}${d === date ? " sel" : ""}${d === today ? " today" : ""}${isDayOff(hs) ? " off" : ""}`}
              style={hs[0] ? holVars(hs[0]) : undefined}>
              <b className="pm-num">{Number(d.slice(8))}</b>
              {shown.map((c) => (
                <span key={c.key} className={`pm-chip ${c.hol ? "hol" : `k-${c.tone}`}`} style={c.hol ? holVars(c.hol) : undefined}>
                  <span className="pm-chip-t">
                    {c.hol ? <HolidayIcon theme={c.hol.theme} className="pm-chip-ic" /> : <KindIcon kind={c.kind!} className="pm-chip-ic" />}{c.label}
                  </span>
                </span>
              ))}
              {more > 0 && <span className="pm-more">+{more}</span>}
              {dots.length > 0 && <span className="pm-dots" aria-hidden="true">{dots.map((t) => <i key={t} className={`k-${t}`} />)}</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
