import Link from "next/link";
import { AlertTriangle, CalendarDays, CalendarHeart, UserRound, ChevronLeft, ChevronRight, Clock, ExternalLink, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { can, type CurrentUser } from "@/lib/auth";
import { bangkokToday } from "@/lib/dates";
import { computeAlerts, getEditableEvent, listMembers, loadCalendarItems } from "@/lib/calendar";
import {
  KIND_TH, KIND_TONE, MANUAL_KINDS, REPEAT_TH, STATUS_TH, VISIBILITY_TH, WEEKDAY_TH,
  addDays, applyFilters, dayColumns, findConflicts, isIsoDate, itemsOn, layoutWeek, minutesOf, monthWeeks, parseView, periodLabel,
  rangeFor, shiftDate, thaiDate, thaiLongDate, timeLabel, weeklyWorkload, weekStart,
  type CalItem, type CalKind, type CalStatus, type CalView, type ManualKind,
} from "@/lib/calendar-core";
import {
  HOLIDAY_YEARS, OFF_TH, THEMES, TYPE_TH, endOf, findHoliday, holidayKey, holidaysIn, holidaysOn, isDayOff, missingYears, type Holiday,
} from "@/lib/holidays-th";
import { HolidayIcon } from "./holiday-icon";
import { KindIcon } from "./kind-icon";
import { FilterAutoSubmit } from "./filter-autosubmit";
import { PhoneDay, PhoneMonth } from "./phone-views";
import { SheetEscape, ViewPicker } from "./phone-client";
import { EventForm } from "./event-form";
import { deleteCalendarEvent, setCalendarEventStatus } from "@/app/(app)/calendar/actions";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const MAX_LANES = 3;
const ALL_KINDS: CalKind[] = ["promotion", "campaign", "content", "appointment", "general", "task", "stock", "court_event", "report", "followup"];
const STATUSES: CalStatus[] = ["planned", "in_progress", "pending_approval", "overdue", "done", "cancelled"];

type State = { view: CalView; date: string; kinds: CalKind[]; owner: string; status: string; mine: boolean; q: string; days: number; hol: boolean };
export type Patch = Partial<State> & { item?: string; new?: string; edit?: string; holiday?: string; k?: ManualKind; sheet?: "filter" | "summary" };

/** Pastel tint + icon colour of a holiday, as CSS variables. */
const holStyle = (h: Holiday) => {
  const t = THEMES[h.theme];
  return { ["--hb" as string]: t.bg, ["--hf" as string]: t.fg, ["--hd" as string]: t.dot };
};

export async function CalendarScreen({ user, searchParams, base, preset }: {
  user: CurrentUser; searchParams: SP; base: string; preset?: { kind: ManualKind; title: string; sub: string };
}) {
  const today = bangkokToday();
  const rawDate = one(searchParams.date);
  const kindsParam = one(searchParams.type).split(",").filter((k): k is CalKind => (ALL_KINDS as string[]).includes(k));
  const st: State = {
    view: parseView(one(searchParams.view)),
    date: isIsoDate(rawDate) ? rawDate : today,
    kinds: preset ? [preset.kind] : kindsParam,
    owner: one(searchParams.owner),
    status: (STATUSES as string[]).includes(one(searchParams.status)) ? one(searchParams.status) : "",
    mine: one(searchParams.mine) === "1",
    q: one(searchParams.q).slice(0, 80),
    days: [7, 30, 90].includes(Number(one(searchParams.days))) ? Number(one(searchParams.days)) : 30,
    hol: one(searchParams.hol) !== "0",
  };
  const href = (patch: Patch = {}) => {
    const s = { ...st, ...patch };
    const p = new URLSearchParams();
    if (s.view !== "day") p.set("view", s.view);
    if (s.date !== today) p.set("date", s.date);
    if (!preset && s.kinds.length) p.set("type", s.kinds.join(","));
    if (s.owner) p.set("owner", s.owner);
    if (s.status) p.set("status", s.status);
    if (s.mine) p.set("mine", "1");
    if (s.q) p.set("q", s.q);
    if (s.view === "agenda" && s.days !== 30) p.set("days", String(s.days));
    if (!s.hol) p.set("hol", "0");
    if (patch.item) p.set("item", patch.item);
    if (patch.holiday) p.set("holiday", patch.holiday);
    if (patch.k) p.set("k", patch.k);
    if (patch.sheet) p.set("sheet", patch.sheet);
    if (patch.new) p.set("new", patch.new);
    if (patch.edit) p.set("edit", patch.edit);
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const range = rangeFor(st.view, st.date, st.days);
  // The weekly summary always covers the week of the selected date, so load at least that week.
  const ws = weekStart(st.date);
  const from = range.from < ws ? range.from : ws;
  const to = range.to > addDays(ws, 6) ? range.to : addDays(ws, 6);
  const manage = can(user, "calendar.manage");
  const [all, members, alerts] = await Promise.all([loadCalendarItems(user, from, to), listMembers(user.orgId), computeAlerts(user)]);
  const filters = { kinds: st.kinds, owner: st.owner || null, status: (st.status || null) as CalStatus | null, mine: st.mine, q: st.q };
  const items = applyFilters(all, filters, user.id);
  const inRange = items.filter((i) => i.start <= range.to && i.end >= range.from);
  // Holidays are calendar context: other filters keep them, a search narrows them by name.
  const hols = st.hol ? holidaysIn(from, to).filter((h) => !st.q.trim() || h.name.toLowerCase().includes(st.q.trim().toLowerCase())) : [];
  const upcoming = st.hol ? holidaysIn(today, addDays(today, 60)).filter((h) => h.date >= today || endOf(h) >= today).slice(0, 5) : [];
  const noHolidayData = st.hol ? missingYears(range.from, range.to) : [];

  const itemKey = one(searchParams.item);
  const editId = one(searchParams.edit);
  const isNew = one(searchParams.new) === "1";
  const holiday = findHoliday(one(searchParams.holiday));
  const kParam = one(searchParams.k) as ManualKind;
  const newKind = preset?.kind ?? ((MANUAL_KINDS as readonly string[]).includes(kParam) ? kParam : undefined);
  const selected = itemKey ? all.find((i) => i.sourceKey === itemKey && i.start <= st.date && i.end >= st.date) ?? all.find((i) => i.sourceKey === itemKey) ?? null : null;
  const editing = manage && editId ? await getEditableEvent(user, editId) : null;
  const panel: "form" | "item" | "holiday" | "summary" = manage && (isNew || editing) ? "form" : itemKey ? "item" : holiday ? "holiday" : "summary";
  const sideLabel = panel === "form" ? (editing ? "แก้ไขรายการ" : "เพิ่มรายการ") : panel === "item" ? "รายละเอียด" : panel === "holiday" ? "วันหยุด / เทศกาล" : "สรุปสัปดาห์";
  const closeHref = href();
  const conflicts = findConflicts(inRange);
  const workload = weeklyWorkload(items, st.date);
  const activeFilters = (preset ? 0 : st.kinds.length ? 1 : 0) + (st.owner ? 1 : 0) + (st.status ? 1 : 0) + (st.mine ? 1 : 0) + (st.q ? 1 : 0);
  const VIEW_TH: Record<CalView, string> = { month: "เดือน", week: "สัปดาห์", day: "วัน", agenda: "รายการ" };
  // iPhone: the side card and the filters open as bottom sheets (RCM v1.1 §6.4, §3.5); the page itself never grows.
  const sheetParam = one(searchParams.sheet);
  const sheet: "" | "side" | "filter" = sheetParam === "filter" ? "filter" : panel !== "summary" || sheetParam === "summary" ? "side" : "";
  const phoneTitle = preset ? preset.title : st.view === "month" ? "ปฏิทินรายเดือน" : st.date === today ? "วันนี้" : "ปฏิทินรายวัน";

  return (
    <div className="cal" data-mscope="cal" data-sheet={sheet || undefined} data-view={st.view}>
      <div className="cal-mhead">
        <div className="cal-mhead-text">
          <p className="cal-mcap">{thaiLongDate(st.date)}</p>
          <h1 className="cal-mtitle">{phoneTitle}</h1>
        </div>
        <ViewPicker label={st.view === "month" ? "รายเดือน" : "รายวัน"} showLabel={st.view === "month"} items={[
          { href: href({ view: "day" }), label: "รายวัน", current: st.view === "day" },
          { href: href({ view: "month" }), label: "รายเดือน", current: st.view === "month" },
          { href: href({ date: today }), label: "ไปวันนี้", divider: true },
          { href: href({ sheet: "filter" }), label: "ตัวกรอง", badge: activeFilters },
          { href: href({ sheet: "summary" }), label: "สรุปสัปดาห์" },
        ]} />
      </div>
      <div className="cal-head">
        <h1 className="inv-title cal-title">
          <span className="badge-icon tone-pink" aria-hidden="true"><CalendarDays /></span>
          {preset ? preset.title : "ปฏิทินกลาง"}<span className="cal-title-sub">{preset ? ` · ${preset.sub}` : " · Calendar"}</span>
        </h1>
        <nav className="seg" aria-label="มุมมอง">
          {(["month", "week", "day", "agenda"] as const).map((v) => (
            <Link key={v} href={href({ view: v })} aria-current={st.view === v ? "page" : undefined}>{VIEW_TH[v]}</Link>
          ))}
        </nav>
        <div className="cal-nav">
          <Link className="icon-circle sm" href={href({ date: shiftDate(st.view, st.date, -1, st.days) })} aria-label="ก่อนหน้า"><ChevronLeft aria-hidden="true" /></Link>
          <strong className="cal-period" aria-live="polite">{periodLabel(st.view, st.date, st.days)}</strong>
          <Link className="icon-circle sm" href={href({ date: shiftDate(st.view, st.date, 1, st.days) })} aria-label="ถัดไป"><ChevronRight aria-hidden="true" /></Link>
          <Link className="btn-pill" href={href({ date: today })}>วันนี้</Link>
        </div>
        {manage && <Link className="btn-pill primary cal-add" href={href({ new: "1" })}><Plus aria-hidden="true" /><span>เพิ่มรายการ</span></Link>}
      </div>

      <div className="cal-body">
        {sheet && <Link className="cal-backdrop" href={closeHref} scroll={false} aria-label="ปิด" />}
        {sheet && <SheetEscape closeHref={closeHref} />}

        <form className="cal-filters" id="cal-filters" action={base} role="search" aria-label="ตัวกรองปฏิทิน">
          <FilterAutoSubmit formId="cal-filters" />
          <div className="cal-sheet-head"><h2>ตัวกรอง</h2><Link className="more" href={closeHref} scroll={false} aria-label="ปิดตัวกรอง"><X aria-hidden="true" /></Link></div>
          {st.view !== "day" && <input type="hidden" name="view" value={st.view} />}
          {st.date !== today && <input type="hidden" name="date" value={st.date} />}
          {!preset && (
            <div className="field"><label htmlFor="cf-type" className="sr-only">ประเภท</label>
              <select id="cf-type" name="type" title="ประเภท" className="w-type" defaultValue={st.kinds.length === 1 ? st.kinds[0] : ""}>
                <option value="">ทุกประเภท</option>
                {ALL_KINDS.filter((k) => k !== "followup" || can(user, "crm.followup")).map((k) => <option key={k} value={k}>{KIND_TH[k]}</option>)}
              </select></div>
          )}
          <div className="field"><label htmlFor="cf-owner" className="sr-only">ผู้รับผิดชอบ</label>
            <select id="cf-owner" name="owner" title="ผู้รับผิดชอบ" className="w-owner" defaultValue={st.owner}><option value="">ทุกคน</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div className="field"><label htmlFor="cf-status" className="sr-only">สถานะ</label>
            <select id="cf-status" name="status" title="สถานะ" className="w-status" defaultValue={st.status}><option value="">ทุกสถานะ</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_TH[s]}</option>)}</select></div>
          {st.view === "agenda" && (
            <div className="field"><label htmlFor="cf-days" className="sr-only">ช่วงเวลา</label>
              <select id="cf-days" name="days" defaultValue={String(st.days)}><option value="7">7 วัน</option><option value="30">30 วัน</option><option value="90">90 วัน</option></select></div>
          )}
          <div className="field grow"><label htmlFor="cf-q" className="sr-only">ค้นหา</label>
            <input id="cf-q" name="q" type="search" placeholder="ค้นหาชื่อรายการหรือรายละเอียด" defaultValue={st.q} /></div>
          <label className="check" title="เฉพาะงานของฉัน"><input type="checkbox" name="mine" value="1" defaultChecked={st.mine} /><UserRound aria-hidden="true" className="chk-ic" /><span className="chk-lbl">งานของฉัน</span></label>
          <label className="check" title="แสดงวันหยุดและเทศกาล"><input type="checkbox" name="hol" value="1" defaultChecked={st.hol} /><input type="hidden" name="hol" value="0" /><CalendarHeart aria-hidden="true" className="chk-ic" /><span className="chk-lbl">วันหยุด / เทศกาล</span></label>
          <button className="btn-pill cal-apply" type="submit">กรอง</button>
          {activeFilters > 0 && <Link className="cal-clear" href={`${base}${st.view !== "day" ? `?view=${st.view}` : ""}`} title="ล้างตัวกรอง"><X aria-hidden="true" /><span className="chk-lbl">ล้างตัวกรอง</span></Link>}
        </form>

        <article className="card panel cal-main" aria-label={`ปฏิทินมุมมอง${VIEW_TH[st.view]}`}>
          {st.view === "day" && <PhoneDay items={items} hols={hols} date={st.date} today={today} href={href} manage={manage} selectedKey={itemKey} canTasks={can(user, "tasks.manage")} />}
          {st.view === "month" && <PhoneMonth items={items} hols={hols} date={st.date} today={today} href={href} />}
          {st.view === "month" && <MonthView items={items} hols={hols} st={st} today={today} href={href} />}
          {st.view === "week" && <WeekView items={items} hols={hols} st={st} today={today} href={href} />}
          {st.view === "day" && <DayView items={items} hols={hols} st={st} href={href} />}
          {st.view === "agenda" && <AgendaView items={inRange} hols={hols} range={range} today={today} href={href} />}
        </article>

        <aside className="card panel cal-side" aria-label={sideLabel}>
          <span className="cal-grab" aria-hidden="true" />
          {sheet === "side" && panel === "summary" && <Link className="more cal-sheet-x" href={closeHref} scroll={false} aria-label="ปิดสรุปสัปดาห์"><X aria-hidden="true" /></Link>}
          {panel === "form" ? (
            <>
              <div className="panel-head">
                <div className="panel-head-text"><h2 className="panel-title">{editing ? `แก้ไข: ${editing.title}` : "+ เพิ่มรายการ"}</h2>
                  <p className="panel-sub">โปรโมชั่น แคมเปญ และงานจากโมดูลอื่นขึ้นปฏิทินอัตโนมัติ ไม่ต้องกรอกซ้ำ</p></div>
                <Link className="more" href={closeHref} aria-label="ปิด"><X aria-hidden="true" /></Link>
              </div>
              <div className="card-body">
                <EventForm event={editing} members={members} me={user.id} defaultDate={st.date} defaultKind={newKind}
                  canFollowup={can(user, "crm.followup")} canExecutive={can(user, "calendar.view_executive")} />
              </div>
            </>
          ) : panel === "holiday" ? (
            <HolidayDetail h={holiday!} closeHref={closeHref} href={href} manage={manage} />
          ) : panel === "item" ? (
            <ItemDetail item={selected} closeHref={closeHref} editHref={selected?.editable ? href({ edit: selected.sourceKey.slice(3) }) : null} back={closeHref} />
          ) : (
            <Summary workload={workload} alerts={alerts} conflicts={conflicts} href={href} upcoming={upcoming} noHolidayData={noHolidayData} showHolidays={st.hol} />
          )}
        </aside>
      </div>
    </div>
  );
}

export type Href = (patch?: Patch) => string;

function Chip({ item, href, showTime = true, className = "" }: { item: CalItem; href: Href; showTime?: boolean; className?: string }) {
  return (
    <Link className={`cal-chip tone-${KIND_TONE[item.kind]} st-${item.status} ${className}`} href={href({ item: item.sourceKey, date: item.start })}
      title={`${item.title} · ${KIND_TH[item.kind]} · ${STATUS_TH[item.status]}`}>
      {showTime && item.startTime && <span className="cal-time">{item.startTime}</span>}
      <span className="cal-chip-title">{item.title}</span>
    </Link>
  );
}

function MonthView({ items, hols, st, today, href }: { items: CalItem[]; hols: Holiday[]; st: State; today: string; href: Href }) {
  const weeks = monthWeeks(st.date);
  const month = st.date.slice(0, 7);
  return (
    <div className="cal-month" style={{ ["--weeks" as string]: weeks.length }}>
      <div className="cal-wd" aria-hidden="true">{WEEKDAY_TH.map((d, i) => <span key={d} className={i >= 5 ? "we" : undefined}>{d}</span>)}</div>
      <div className="cal-weeks">
        {weeks.map((week) => {
          const segs = layoutWeek(items, week[0]);
          const hidden = week.map((_, c) => segs.filter((s) => s.lane >= MAX_LANES && s.col <= c && s.col + s.span > c).length);
          return (
            <div className="cal-wk" key={week[0]}>
              {week.map((d, c) => {
                const on = itemsOn(items, d);
                const hs = holidaysOn(hols, d);
                const h0 = hs[0];
                const holLabel = hs.length ? ` · ${hs.map((h) => h.name).join(", ")}` : "";
                return (
                  <div key={d} className={`cal-cell${d.slice(0, 7) !== month ? " out" : ""}${d === today ? " today" : ""}${d === st.date ? " sel" : ""}${h0 ? " hol" : ""}${isDayOff(hs) ? " off" : ""}`}
                    style={{ gridColumn: c + 1, ...(h0 ? holStyle(h0) : {}) }}>
                    <div className="cal-cell-top">
                      <Link className="cal-dnum" href={href({ view: "day", date: d })} aria-label={`${thaiDate(d, { weekday: true })}${holLabel} · ${on.length} รายการ`}>{Number(d.slice(8))}</Link>
                      {h0 && (
                        <Link className="cal-hol" href={href({ holiday: holidayKey(h0), date: d })} title={hs.map((h) => h.name).join(" · ")}>
                          <HolidayIcon theme={h0.theme} className="cal-hol-ic" /><span className="cal-hol-name">{h0.name}</span>
                          {hs.length > 1 && <b className="cal-hol-more">+{hs.length - 1}</b>}
                        </Link>
                      )}
                    </div>
                    <Link className="cal-pick" href={href({ date: d })} aria-label={`เลือก ${thaiDate(d, { weekday: true })}${holLabel} · ${on.length} รายการ`}>
                      <span className="cal-pick-num">{Number(d.slice(8))}</span>
                      <span className="cal-dots" aria-hidden="true">
                        {h0 && <HolidayIcon theme={h0.theme} className="cal-pick-hol" />}
                        {[...new Set(on.filter((i) => i.start === d).map((i) => KIND_TONE[i.kind]))].slice(0, 3).map((t) => <i key={t} className={`tone-${t}`} />)}
                      </span>
                    </Link>
                    {hidden[c] > 0 && <Link className="cal-more" href={href({ view: "day", date: d })}>+{hidden[c]} รายการ</Link>}
                  </div>
                );
              })}
              {segs.filter((s) => s.lane < MAX_LANES).map((s) => (
                <Link key={s.item.key} className={`cal-bar tone-${KIND_TONE[s.item.kind]} st-${s.item.status}${s.fromBefore ? " cont-l" : ""}${s.toAfter ? " cont-r" : ""}`}
                  style={{ gridColumn: `${s.col + 1} / span ${s.span}`, gridRow: s.lane + 2 }}
                  href={href({ item: s.item.sourceKey, date: s.item.start < week[0] ? week[0] : s.item.start })}
                  title={`${s.item.title} · ${KIND_TH[s.item.kind]} · ${s.item.start === s.item.end ? thaiDate(s.item.start) : `${thaiDate(s.item.start)} – ${thaiDate(s.item.end)}`}`}>
                  {s.item.startTime && s.span === 1 && <span className="cal-time">{s.item.startTime}</span>}
                  <span className="cal-chip-title">{s.item.title}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ items, hols, st, today, href }: { items: CalItem[]; hols: Holiday[]; st: State; today: string; href: Href }) {
  const ws = weekStart(st.date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const banner = items.filter((i) => !i.startTime || i.start !== i.end);
  const timed = items.filter((i) => i.startTime && i.start === i.end);
  const segs = layoutWeek(banner, ws);
  const lanes = segs.reduce((m, s) => Math.max(m, s.lane + 1), 0);
  return (
    <div className="cal-weekview">
      <div className="cal-wv-grid" style={{ ["--lanes" as string]: lanes }}>
        {days.map((d, c) => {
          const hs = holidaysOn(hols, d);
          const h0 = hs[0];
          return (
            <div key={d} className={`cal-wv-day${d === today ? " today" : ""}${h0 ? " hol" : ""}${isDayOff(hs) ? " off" : ""}`} style={{ gridColumn: c + 1, ...(h0 ? holStyle(h0) : {}) }}>
              <Link className="cal-wv-date" href={href({ view: "day", date: d })}><span>{WEEKDAY_TH[c]}</span><b>{Number(d.slice(8))}</b></Link>
              {h0 && (
                <Link className="cal-hol" href={href({ holiday: holidayKey(h0), date: d })} title={hs.map((h) => h.name).join(" · ")}>
                  <HolidayIcon theme={h0.theme} className="cal-hol-ic" /><span className="cal-hol-name">{h0.name}</span>
                </Link>
              )}
            </div>
          );
        })}
        {segs.map((s) => (
          <Link key={s.item.key} className={`cal-bar tone-${KIND_TONE[s.item.kind]} st-${s.item.status}${s.fromBefore ? " cont-l" : ""}${s.toAfter ? " cont-r" : ""}`}
            style={{ gridColumn: `${s.col + 1} / span ${s.span}`, gridRow: s.lane + 2 }} href={href({ item: s.item.sourceKey, date: s.item.start < ws ? ws : s.item.start })}>
            <span className="cal-chip-title">{s.item.title}</span>
          </Link>
        ))}
        {days.map((d, c) => (
          <div key={`col-${d}`} className="cal-wv-col" style={{ gridColumn: c + 1, gridRow: lanes + 2 }}>
            {itemsOn(timed, d).map((i) => <Chip key={i.key} item={i} href={href} />)}
          </div>
        ))}
      </div>
      <div className="cal-wv-list">
        {days.map((d) => {
          const on = itemsOn(items, d);
          return (
            <section key={d} className={`cal-ag-day${d === today ? " today" : ""}`}>
              <h3><Link href={href({ view: "day", date: d })}>{thaiDate(d, { weekday: true })}</Link> <small>{on.length ? `${on.length} รายการ` : ""}</small></h3>
              <HolidayRows list={holidaysOn(hols, d)} href={href} />
              <AgendaRows items={on} href={href} empty={holidaysOn(hols, d).length ? undefined : "—"} />
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ items, hols, st, href }: { items: CalItem[]; hols: Holiday[]; st: State; href: Href }) {
  const on = itemsOn(items, st.date);
  const allDay = on.filter((i) => !i.startTime || i.start !== i.end);
  const timedSameDay = on.filter((i) => i.startTime && i.start === i.end);
  const cols = dayColumns(timedSameDay, st.date);
  const first = Math.min(6, ...timedSameDay.map((i) => Math.floor(minutesOf(i.startTime!) / 60)));
  const last = Math.max(22, ...cols.map((c) => Math.ceil((c.top + c.height) / 60)));
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const PX = 0.9; // px per minute
  const ws = weekStart(st.date);
  const strip = Array.from({ length: 7 }, (_, k) => addDays(ws, k));
  const dayHols = holidaysOn(hols, st.date);
  const timedSorted = [...timedSameDay].sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  return (
    <div className="cal-dayview">
      <nav className="cal-strip" aria-label="เลือกวันในสัปดาห์">
        {strip.map((d, k) => {
          const hs = holidaysOn(hols, d);
          return (
            <Link key={d} href={href({ view: "day", date: d })} aria-current={d === st.date ? "date" : undefined}
              className={`${d === st.date ? "sel" : ""}${d === bangkokToday() ? " today" : ""}${hs.length ? " hol" : ""}`} style={hs[0] ? holStyle(hs[0]) : undefined}>
              <span>{WEEKDAY_TH[k]}</span><b>{Number(d.slice(8))}</b>
              <i className={itemsOn(items, d).some((i) => i.start === d) ? "has" : undefined} aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
      <div className="cal-daylist">
        <HolidayRows list={dayHols} href={href} />
        <AgendaRows items={allDay} href={href} compact />
        {timedSorted.length === 0 && !allDay.length && !dayHols.length && <p className="muted small cal-empty">ไม่มีรายการในวันนี้</p>}
        {timedSorted.length > 0 && (
          <ol className="cal-tl">
            {timedSorted.map((i) => (
              <li key={i.key}>
                <span className="cal-tl-time">{i.startTime}</span>
                <Link className={`cal-tl-card tone-${KIND_TONE[i.kind]} st-${i.status}`} href={href({ item: i.sourceKey, date: i.start })}>
                  {i.endTime && <span className="cal-tl-range">{timeLabel(i)}</span>}
                  <span className="cal-row-title">{i.title}</span>
                  <span className="cal-row-sub">{KIND_TH[i.kind]}{i.ownerName ? ` · ${i.ownerName}` : ""}</span>
                  {(i.status === "overdue" || i.status === "pending_approval" || i.status === "done") && <span className={`cal-status st-${i.status}`}>{STATUS_TH[i.status]}</span>}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="cal-allday">
        <span className="cal-allday-label">ทั้งวัน / หลายวัน</span>
        <div className="cal-allday-items">
          {holidaysOn(hols, st.date).map((h) => <HolidayChip key={holidayKey(h)} h={h} href={href} day={st.date} />)}
          {allDay.map((i) => <Chip key={i.key} item={i} href={href} showTime={false} />)}
          {!allDay.length && !holidaysOn(hols, st.date).length && <span className="muted small">—</span>}
        </div>
      </div>
      <div className="cal-timeline" style={{ height: (last - first + 1) * 60 * PX }}>
        {hours.map((h) => (
          <div key={h} className="cal-hour" style={{ top: (h - first) * 60 * PX }}><span>{String(h).padStart(2, "0")}:00</span></div>
        ))}
        {cols.map((c) => (
          <Link key={c.item.key} className={`cal-block tone-${KIND_TONE[c.item.kind]} st-${c.item.status}`} href={href({ item: c.item.sourceKey, date: c.item.start })}
            style={{ top: (c.top - first * 60) * PX, height: Math.max(26, c.height * PX - 2), left: `calc(64px + (100% - 68px) * ${c.col} / ${c.cols})`, width: `calc((100% - 68px) / ${c.cols} - 4px)` }}>
            <span className="cal-time">{timeLabel(c.item)}</span> <span className="cal-chip-title">{c.item.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AgendaView({ items, hols, range, today, href }: { items: CalItem[]; hols: Holiday[]; range: { from: string; to: string }; today: string; href: Href }) {
  const days: string[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d);
  const groups = days.map((d) => ({
    d,
    on: itemsOn(items, d).filter((i) => i.start === d || d === range.from),
    hs: holidaysOn(hols, d).filter((h) => h.date === d || d === range.from),
  })).filter((g) => g.on.length || g.hs.length);
  return (
    <div className="cal-agenda">
      {groups.length === 0 ? (
        <div className="empty-state"><strong>ไม่มีรายการในช่วงนี้</strong><span>ลองเปลี่ยนตัวกรองหรือช่วงเวลา</span></div>
      ) : groups.map((g) => (
        <section key={g.d} className={`cal-ag-day${g.d === today ? " today" : ""}`}>
          <h3>{thaiDate(g.d, { weekday: true, year: true })}{g.d === today ? <small> · วันนี้</small> : null}</h3>
          <HolidayRows list={g.hs} href={href} />
          <AgendaRows items={g.on} href={href} />
        </section>
      ))}
    </div>
  );
}

function TimeCell({ i, compact = false }: { i: CalItem; compact?: boolean }) {
  if (compact && (i.start !== i.end || !i.startTime)) return <span className="cal-row-time"><b>ทั้งวัน</b></span>;
  if (i.start !== i.end) return <span className="cal-row-time"><b>{thaiDate(i.start)}</b><small>– {thaiDate(i.end)}</small></span>;
  if (!i.startTime) return <span className="cal-row-time"><b>ทั้งวัน</b></span>;
  return <span className="cal-row-time"><b>{i.startTime}</b>{i.endTime && <small>{i.endTime}</small>}</span>;
}

function AgendaRows({ items, href, empty, compact = false }: { items: CalItem[]; href: Href; empty?: string; compact?: boolean }) {
  if (!items.length) return empty ? <p className="muted small cal-empty">{empty}</p> : null;
  return (
    <ul className="cal-rows">
      {items.map((i) => (
        <li key={i.key}>
          <Link className={`cal-row st-${i.status}`} href={href({ item: i.sourceKey, date: i.start })}>
            <span className={`cal-dot tone-${KIND_TONE[i.kind]}`} aria-hidden="true" />
            <TimeCell i={i} compact={compact} />
            <span className="cal-row-main"><span className="cal-row-title">{i.title}</span>
              <span className="cal-row-sub">{KIND_TH[i.kind]}{compact && i.start !== i.end ? ` · ${thaiDate(i.start)} – ${thaiDate(i.end)}` : ""}{i.ownerName ? ` · ${i.ownerName}` : ""}</span></span>
            <span className={`cal-status st-${i.status}`}>{STATUS_TH[i.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ItemDetail({ item, closeHref, editHref, back }: { item: CalItem | null; closeHref: string; editHref: string | null; back: string }) {
  if (!item) {
    return (
      <>
        <div className="panel-head"><div className="panel-head-text"><h2 className="panel-title">ไม่พบรายการ</h2></div>
          <Link className="more" href={closeHref} aria-label="ปิด"><X aria-hidden="true" /></Link></div>
        <div className="card-body"><p className="muted">รายการนี้อาจถูกลบ ย้ายวัน หรือคุณไม่มีสิทธิ์ดู</p></div>
      </>
    );
  }
  const id = item.sourceKey.startsWith("ev:") ? item.sourceKey.slice(3) : null;
  return (
    <>
      <div className="panel-head">
        <span className={`badge-icon tone-${KIND_TONE[item.kind]}`} aria-hidden="true"><KindIcon kind={item.kind} /></span>
        <div className="panel-head-text"><h2 className="panel-title">{item.title}</h2>
          <p className="panel-sub">{KIND_TH[item.kind]} · {item.source === "manual" ? "เพิ่มในปฏิทิน" : "ดึงจากโมดูลต้นทางอัตโนมัติ"}</p></div>
        <Link className="more" href={closeHref} aria-label="ปิด"><X aria-hidden="true" /></Link>
      </div>
      <div className="card-body">
        <dl className="cal-dl">
          <dt>วันที่</dt><dd>{item.start === item.end ? thaiDate(item.start, { weekday: true, year: true }) : `${thaiDate(item.start, { weekday: true })} – ${thaiDate(item.end, { weekday: true, year: true })}`}</dd>
          <dt>เวลา</dt><dd><Clock aria-hidden="true" className="inline-ic" /> {timeLabel(item)}</dd>
          <dt>สถานะ</dt><dd><span className={`cal-status st-${item.status}`}>{STATUS_TH[item.status]}</span></dd>
          <dt>ผู้รับผิดชอบ</dt><dd><Users aria-hidden="true" className="inline-ic" /> {item.ownerName ?? "ไม่ระบุ"}</dd>
          {item.repeat && item.repeat !== "none" && (<><dt>ทำซ้ำ</dt><dd>{REPEAT_TH[item.repeat]}{item.repeatUntil ? ` ถึง ${thaiDate(item.repeatUntil, { year: true })}` : ""}</dd></>)}
          {item.visibility && (<><dt>การมองเห็น</dt><dd>{VISIBILITY_TH[item.visibility]}</dd></>)}
          {item.remindMinutes != null && (<><dt>แจ้งเตือน</dt><dd>{item.remindMinutes === 0 ? "เมื่อถึงเวลาเริ่ม" : item.remindMinutes >= 1440 ? `ก่อน ${item.remindMinutes / 1440} วัน` : item.remindMinutes >= 60 ? `ก่อน ${item.remindMinutes / 60} ชั่วโมง` : `ก่อน ${item.remindMinutes} นาที`}</dd></>)}
        </dl>
        {item.details && <p className="cal-details">{item.details}</p>}
        <div className="cal-actions">
          {item.href && (item.href.startsWith("http")
            ? <a className="btn-pill primary" href={item.href} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />{item.hrefLabel}</a>
            : <Link className="btn-pill primary" href={item.href}><ExternalLink aria-hidden="true" />{item.hrefLabel}</Link>)}
          {item.linkUrl && item.href !== item.linkUrl && <a className="btn-pill" href={item.linkUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />เปิดลิงก์แนบ</a>}
          {editHref && <Link className="btn-pill" href={editHref}><Pencil aria-hidden="true" />แก้ไข</Link>}
          {item.editable && id && item.status !== "done" && (
            <form action={setCalendarEventStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="done" />
              <button className="btn-pill" type="submit">ทำเครื่องหมายว่าเสร็จ</button></form>
          )}
        </div>
        {item.source !== "manual" && <p className="muted small">แก้ไขวันหรือรายละเอียดที่โมดูลต้นทาง ปฏิทินจะอัปเดตตามทันที</p>}
        {item.editable && id && (
          <form action={deleteCalendarEvent} className="cal-delete">
            <input type="hidden" name="id" value={id} /><input type="hidden" name="back" value={back} />
            <button className="link-btn small danger" type="submit"><Trash2 aria-hidden="true" className="inline-ic" /> ลบรายการ “{item.title}”{item.repeat && item.repeat !== "none" ? " (ทุกครั้งที่ทำซ้ำ)" : ""}</button>
          </form>
        )}
      </div>
    </>
  );
}

function Summary({ workload: w, alerts, conflicts, href, upcoming, noHolidayData, showHolidays }: {
  workload: ReturnType<typeof weeklyWorkload>; alerts: Awaited<ReturnType<typeof computeAlerts>>; conflicts: [CalItem, CalItem][]; href: Href;
  upcoming: Holiday[]; noHolidayData: number[]; showHolidays: boolean;
}) {
  const max = Math.max(1, ...w.perDay.map((d) => d.count));
  return (
    <>
      <div className="panel-head">
        <span className="badge-icon tone-purple" aria-hidden="true"><CalendarDays /></span>
        <div className="panel-head-text"><h2 className="panel-title">ภาระงานสัปดาห์นี้</h2><p className="panel-sub">{thaiDate(w.from)} – {thaiDate(w.to, { year: true })}</p></div>
      </div>
      <div className="card-body">
        <div className="cal-wl">
          <div className="wl-pink"><b>{w.total}</b><span>งานทั้งหมด</span></div>
          <div className="wl-green"><b>{w.done}</b><span>เสร็จแล้ว</span></div>
          <div className="wl-amber"><b>{w.overdue}</b><span>เกินกำหนด</span></div>
          <div className="wl-purple"><b>{w.pending}</b><span>รออนุมัติ</span></div>
        </div>
        <div className="cal-wl-bars" role="img" aria-label={`จำนวนงานรายวัน: ${w.perDay.map((d) => `${thaiDate(d.date)} ${d.count}`).join(", ")}`}>
          {w.perDay.map((d, i) => (
            <Link key={d.date} href={href({ view: "day", date: d.date })} className={w.busiest?.date === d.date ? "busy" : ""}>
              <i style={{ height: `${Math.round((d.count / max) * 100)}%` }} /><span>{WEEKDAY_TH[i]}</span><b>{d.count}</b>
            </Link>
          ))}
        </div>
        {w.busiest && <p className="small muted">ช่วงที่แน่นที่สุด: {thaiDate(w.busiest.date, { weekday: true })} ({w.busiest.count} รายการ)</p>}

        <h3 className="cal-sub-h">แจ้งเตือน <small>({alerts.length})</small></h3>
        {alerts.length === 0 ? <p className="muted small">ไม่มีเรื่องที่ต้องรีบจัดการ</p> : (
          <ul className="cal-rows">
            {alerts.slice(0, 12).map((a) => (
              <li key={a.key}><Link className="cal-row" href={a.href}><span className={`cal-dot tone-${a.tone}`} aria-hidden="true" />
                <span className="cal-row-main"><span className="cal-row-title">{a.title}</span><span className="cal-row-sub">{a.body}</span></span></Link></li>
            ))}
          </ul>
        )}

        <h3 className="cal-sub-h"><AlertTriangle aria-hidden="true" className="inline-ic" /> เวลาซ้อนกัน <small>({conflicts.length})</small></h3>
        {conflicts.length === 0 ? <p className="muted small">ไม่มีนัดหรือรายการที่เวลาชนกันในช่วงที่แสดง</p> : (
          <ul className="cal-rows">
            {conflicts.slice(0, 10).map(([a, b]) => (
              <li key={`${a.key}|${b.key}`}><Link className="cal-row" href={href({ view: "day", date: a.start })}><span className="cal-dot tone-amber" aria-hidden="true" />
                <span className="cal-row-main"><span className="cal-row-title">{a.title} ↔ {b.title}</span>
                  <span className="cal-row-sub">{thaiDate(a.start, { weekday: true })} · {timeLabel(a)} / {timeLabel(b)}</span></span></Link></li>
            ))}
          </ul>
        )}

        {showHolidays && (
          <>
            <h3 className="cal-sub-h">วันหยุดและเทศกาลที่กำลังจะถึง</h3>
            {upcoming.length === 0 ? <p className="muted small">ไม่มีใน 60 วันข้างหน้า</p> : <HolidayRows list={upcoming} href={href} withDate />}
            {noHolidayData.length > 0 && (
              <p className="muted small">ยังไม่มีข้อมูลวันหยุดปี {noHolidayData.map((y) => y + 543).join(", ")} (มีข้อมูลปี {HOLIDAY_YEARS.map((y) => y + 543).join(", ")}) จะเพิ่มเมื่อมีประกาศทางการ</p>
            )}
          </>
        )}

        <h3 className="cal-sub-h">สีของรายการ</h3>
        <ul className="cal-legend">
          {(["promotion", "content", "appointment", "stock", "general"] as const).map((k) => <li key={k}><i className={`tone-${KIND_TONE[k]}`} />{k === "general" ? "งาน / รายงาน" : KIND_TH[k]}</li>)}
        </ul>
        {showHolidays && <p className="muted small">วันหยุดและเทศกาลแสดงด้วยไอคอนและสีประจำเทศกาล วันที่เป็นวันหยุดราชการหรือธนาคาร ตัวเลขวันที่จะเป็นสีของเทศกาลนั้น</p>}
        <p className="muted small">รายการจากโปรโมชั่น แคมเปญ งานพร้อม Deadline และสต็อกที่ต้องสั่ง ขึ้นอัตโนมัติจากโมดูลต้นทาง</p>
      </div>
    </>
  );
}

function HolidayChip({ h, href, day }: { h: Holiday; href: Href; day: string }) {
  return (
    <Link className="cal-chip cal-hol-chip" style={holStyle(h)} href={href({ holiday: holidayKey(h), date: day })} title={`${h.name} · ${TYPE_TH[h.type]}`}>
      <HolidayIcon theme={h.theme} className="cal-hol-ic" /><span className="cal-chip-title">{h.name}</span>
    </Link>
  );
}

function HolidayRows({ list, href, withDate = false }: { list: Holiday[]; href: Href; withDate?: boolean }) {
  if (!list.length) return null;
  return (
    <ul className="cal-rows cal-hol-rows">
      {list.map((h) => (
        <li key={holidayKey(h)}>
          <Link className="cal-row" style={holStyle(h)} href={href({ holiday: holidayKey(h), date: h.date })}>
            <span className="cal-hol-badge" aria-hidden="true"><HolidayIcon theme={h.theme} /></span>
            <span className="cal-row-time">{h.end ? <><b>{thaiDate(h.date)}</b><small>– {thaiDate(h.end)}</small></> : <b>{withDate ? thaiDate(h.date) : "ทั้งวัน"}</b>}</span>
            <span className="cal-row-main"><span className="cal-row-title">{h.name}</span>
              <span className="cal-row-sub">{h.off ? OFF_TH[h.off] : TYPE_TH[h.type]}{h.pending ? " · รอมติ ครม." : ""}</span></span>
            <span className={`cal-status hol-type t-${h.type}`}>{h.off && !h.pending ? "วันหยุด" : TYPE_TH[h.type]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function HolidayDetail({ h, closeHref, href, manage }: { h: Holiday; closeHref: string; href: Href; manage: boolean }) {
  const t = THEMES[h.theme];
  return (
    <>
      <div className="panel-head" style={holStyle(h)}>
        <span className="badge-icon cal-hol-badge lg" aria-hidden="true"><HolidayIcon theme={h.theme} /></span>
        <div className="panel-head-text"><h2 className="panel-title">{h.name}</h2>
          <p className="panel-sub">{TYPE_TH[h.type]} · ข้อมูลอ้างอิงจากปฏิทินทางการ</p></div>
        <Link className="more" href={closeHref} aria-label="ปิด"><X aria-hidden="true" /></Link>
      </div>
      <div className="card-body">
        <dl className="cal-dl">
          <dt>วันที่</dt><dd>{h.end ? `${thaiDate(h.date, { weekday: true })} – ${thaiDate(h.end, { weekday: true, year: true })}` : thaiDate(h.date, { weekday: true, year: true })}</dd>
          <dt>การหยุด</dt><dd>{h.off ? OFF_TH[h.off] : "ไม่ใช่วันหยุดราชการ"}{h.pending ? " · รอมติคณะรัฐมนตรี" : ""}</dd>
          <dt>สีประจำวัน</dt><dd><span className="cal-swatch" style={holStyle(h)} aria-hidden="true" /> {t.colorTh}</dd>
        </dl>
        <p className="cal-details">{t.why}{h.note ? `\n${h.note}` : ""}</p>
        {manage && (
          <div className="cal-actions">
            <Link className="btn-pill primary" href={href({ new: "1", date: h.date, k: "content", holiday: undefined })}><Plus aria-hidden="true" />วางแผนคอนเทนต์วันนี้</Link>
            <Link className="btn-pill" href={href({ new: "1", date: h.date, k: "promotion", holiday: undefined })}><Plus aria-hidden="true" />วางแผนโปรโมชั่น</Link>
          </div>
        )}
        <p className="muted small">วันหยุดของบริษัทเอกชนขึ้นกับประกาศของแต่ละที่ ข้อมูลนี้อ้างอิงมติคณะรัฐมนตรีและประกาศธนาคารแห่งประเทศไทย</p>
      </div>
    </>
  );
}

export const MANUAL_KIND_LIST = MANUAL_KINDS;
