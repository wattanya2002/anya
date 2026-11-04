import Link from "next/link";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { can, type CurrentUser } from "@/lib/auth";
import { bangkokToday } from "@/lib/dates";
import { computeAlerts, getEditableEvent, listMembers, loadCalendarItems } from "@/lib/calendar";
import {
  KIND_TH, KIND_TONE, MANUAL_KINDS, REPEAT_TH, STATUS_TH, VISIBILITY_TH, WEEKDAY_TH,
  addDays, applyFilters, dayColumns, findConflicts, isIsoDate, itemsOn, layoutWeek, minutesOf, monthWeeks, parseView, periodLabel,
  rangeFor, shiftDate, thaiDate, timeLabel, weeklyWorkload, weekStart,
  type CalItem, type CalKind, type CalStatus, type CalView, type ManualKind,
} from "@/lib/calendar-core";
import { MobileTabs } from "@/components/mobile-tabs";
import { EventForm } from "./event-form";
import { deleteCalendarEvent, setCalendarEventStatus } from "@/app/(app)/calendar/actions";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const MAX_LANES = 3;
const ALL_KINDS: CalKind[] = ["promotion", "campaign", "content", "appointment", "general", "task", "stock", "court_event", "report", "followup"];
const STATUSES: CalStatus[] = ["planned", "in_progress", "pending_approval", "overdue", "done", "cancelled"];

type State = { view: CalView; date: string; kinds: CalKind[]; owner: string; status: string; mine: boolean; q: string; days: number };

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
  };
  const href = (patch: Partial<State> & { item?: string; new?: string; edit?: string } = {}) => {
    const s = { ...st, ...patch };
    const p = new URLSearchParams();
    if (s.view !== "month") p.set("view", s.view);
    if (s.date !== today) p.set("date", s.date);
    if (!preset && s.kinds.length) p.set("type", s.kinds.join(","));
    if (s.owner) p.set("owner", s.owner);
    if (s.status) p.set("status", s.status);
    if (s.mine) p.set("mine", "1");
    if (s.q) p.set("q", s.q);
    if (s.view === "agenda" && s.days !== 30) p.set("days", String(s.days));
    if (patch.item) p.set("item", patch.item);
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

  const itemKey = one(searchParams.item);
  const editId = one(searchParams.edit);
  const isNew = one(searchParams.new) === "1";
  const selected = itemKey ? all.find((i) => i.sourceKey === itemKey && i.start <= st.date && i.end >= st.date) ?? all.find((i) => i.sourceKey === itemKey) ?? null : null;
  const editing = manage && editId ? await getEditableEvent(user, editId) : null;
  const panel: "form" | "item" | "summary" = manage && (isNew || editing) ? "form" : itemKey ? "item" : "summary";
  const sideTab = panel === "form" ? `side-f-${editId || "new"}` : panel === "item" ? `side-i-${itemKey}-${st.date}` : "side";
  const sideLabel = panel === "form" ? (editing ? "แก้ไขรายการ" : "เพิ่มรายการ") : panel === "item" ? "รายละเอียด" : "สรุปสัปดาห์";
  const closeHref = href();
  const conflicts = findConflicts(inRange);
  const workload = weeklyWorkload(items, st.date);
  const activeFilters = (preset ? 0 : st.kinds.length ? 1 : 0) + (st.owner ? 1 : 0) + (st.status ? 1 : 0) + (st.mine ? 1 : 0) + (st.q ? 1 : 0);
  const VIEW_TH: Record<CalView, string> = { month: "เดือน", week: "สัปดาห์", day: "วัน", agenda: "รายการ" };

  return (
    <div className="cal" data-mscope="cal">
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
        <MobileTabs scope="cal" label="เลือกการ์ด" defaultTab={panel === "summary" ? "main" : sideTab} tabs={[
          { id: "main", label: "ปฏิทิน" }, { id: sideTab, label: sideLabel }, { id: "filter", label: activeFilters ? `ตัวกรอง (${activeFilters})` : "ตัวกรอง" },
        ]} />

        <form className="cal-filters" action={base} role="search" data-tab="filter">
          {st.view !== "month" && <input type="hidden" name="view" value={st.view} />}
          {st.date !== today && <input type="hidden" name="date" value={st.date} />}
          {!preset && (
            <div className="field"><label htmlFor="cf-type">ประเภท</label>
              <select id="cf-type" name="type" defaultValue={st.kinds.length === 1 ? st.kinds[0] : ""}>
                <option value="">ทุกประเภท</option>
                {ALL_KINDS.filter((k) => k !== "followup" || can(user, "crm.followup")).map((k) => <option key={k} value={k}>{KIND_TH[k]}</option>)}
              </select></div>
          )}
          <div className="field"><label htmlFor="cf-owner">ผู้รับผิดชอบ</label>
            <select id="cf-owner" name="owner" defaultValue={st.owner}><option value="">ทุกคน</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div className="field"><label htmlFor="cf-status">สถานะ</label>
            <select id="cf-status" name="status" defaultValue={st.status}><option value="">ทุกสถานะ</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_TH[s]}</option>)}</select></div>
          {st.view === "agenda" && (
            <div className="field"><label htmlFor="cf-days">ช่วงเวลา</label>
              <select id="cf-days" name="days" defaultValue={String(st.days)}><option value="7">7 วัน</option><option value="30">30 วัน</option><option value="90">90 วัน</option></select></div>
          )}
          <div className="field grow"><label htmlFor="cf-q">ค้นหา</label>
            <input id="cf-q" name="q" type="search" placeholder="ชื่อรายการ / รายละเอียด" defaultValue={st.q} /></div>
          <label className="check"><input type="checkbox" name="mine" value="1" defaultChecked={st.mine} /> เฉพาะงานของฉัน</label>
          <button className="btn-pill" type="submit">กรอง</button>
          {activeFilters > 0 && <Link className="link-btn small" href={`${base}${st.view !== "month" ? `?view=${st.view}` : ""}`}>ล้างตัวกรอง</Link>}
        </form>

        <article className="card panel cal-main" data-tab="main" aria-label={`ปฏิทินมุมมอง${VIEW_TH[st.view]}`}>
          {st.view === "month" && <MonthView items={items} st={st} today={today} href={href} />}
          {st.view === "week" && <WeekView items={items} st={st} today={today} href={href} />}
          {st.view === "day" && <DayView items={items} st={st} href={href} />}
          {st.view === "agenda" && <AgendaView items={inRange} range={range} today={today} href={href} />}
        </article>

        <aside className="card panel cal-side" data-tab={sideTab} aria-label={sideLabel}>
          {panel === "form" ? (
            <>
              <div className="panel-head">
                <div className="panel-head-text"><h2 className="panel-title">{editing ? `แก้ไข: ${editing.title}` : "+ เพิ่มรายการ"}</h2>
                  <p className="panel-sub">โปรโมชั่น แคมเปญ และงานจากโมดูลอื่นขึ้นปฏิทินอัตโนมัติ ไม่ต้องกรอกซ้ำ</p></div>
                <Link className="more" href={closeHref} aria-label="ปิด"><X aria-hidden="true" /></Link>
              </div>
              <div className="card-body">
                <EventForm event={editing} members={members} me={user.id} defaultDate={st.date} defaultKind={preset?.kind}
                  canFollowup={can(user, "crm.followup")} canExecutive={can(user, "calendar.view_executive")} />
              </div>
            </>
          ) : panel === "item" ? (
            <ItemDetail item={selected} closeHref={closeHref} editHref={selected?.editable ? href({ edit: selected.sourceKey.slice(3) }) : null} back={closeHref} />
          ) : (
            <Summary workload={workload} alerts={alerts} conflicts={conflicts} href={href} />
          )}
        </aside>
      </div>
    </div>
  );
}

type Href = (patch?: Partial<State> & { item?: string; new?: string; edit?: string }) => string;

function Chip({ item, href, showTime = true, className = "" }: { item: CalItem; href: Href; showTime?: boolean; className?: string }) {
  return (
    <Link className={`cal-chip tone-${KIND_TONE[item.kind]} st-${item.status} ${className}`} href={href({ item: item.sourceKey, date: item.start })}
      title={`${item.title} · ${KIND_TH[item.kind]} · ${STATUS_TH[item.status]}`}>
      {showTime && item.startTime && <span className="cal-time">{item.startTime}</span>}
      <span className="cal-chip-title">{item.title}</span>
    </Link>
  );
}

function MonthView({ items, st, today, href }: { items: CalItem[]; st: State; today: string; href: Href }) {
  const weeks = monthWeeks(st.date);
  const month = st.date.slice(0, 7);
  const dayItems = itemsOn(items, st.date);
  return (
    <div className="cal-month" style={{ ["--weeks" as string]: weeks.length }}>
      <div className="cal-wd" aria-hidden="true">{WEEKDAY_TH.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="cal-weeks">
        {weeks.map((week) => {
          const segs = layoutWeek(items, week[0]);
          const hidden = week.map((_, c) => segs.filter((s) => s.lane >= MAX_LANES && s.col <= c && s.col + s.span > c).length);
          return (
            <div className="cal-wk" key={week[0]}>
              {week.map((d, c) => {
                const on = itemsOn(items, d);
                return (
                  <div key={d} className={`cal-cell${d.slice(0, 7) !== month ? " out" : ""}${d === today ? " today" : ""}${d === st.date ? " sel" : ""}`} style={{ gridColumn: c + 1 }}>
                    <Link className="cal-dnum" href={href({ view: "day", date: d })} aria-label={`${thaiDate(d, { weekday: true })} · ${on.length} รายการ`}>{Number(d.slice(8))}</Link>
                    <Link className="cal-pick" href={href({ date: d })} aria-label={`เลือก ${thaiDate(d, { weekday: true })} · ${on.length} รายการ`}>
                      <span className="cal-pick-num">{Number(d.slice(8))}</span>
                      <span className="cal-dots" aria-hidden="true">{on.slice(0, 3).map((i) => <i key={i.key} className={`tone-${KIND_TONE[i.kind]}`} />)}</span>
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
      <section className="cal-dayagenda" aria-label={`รายการวันที่ ${thaiDate(st.date)}`}>
        <h2>{thaiDate(st.date, { weekday: true, year: true })} <small>({dayItems.length} รายการ)</small></h2>
        <AgendaRows items={dayItems} href={href} empty="ไม่มีรายการในวันนี้" />
      </section>
    </div>
  );
}

function WeekView({ items, st, today, href }: { items: CalItem[]; st: State; today: string; href: Href }) {
  const ws = weekStart(st.date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const banner = items.filter((i) => !i.startTime || i.start !== i.end);
  const timed = items.filter((i) => i.startTime && i.start === i.end);
  const segs = layoutWeek(banner, ws);
  const lanes = segs.reduce((m, s) => Math.max(m, s.lane + 1), 0);
  return (
    <div className="cal-weekview">
      <div className="cal-wv-grid" style={{ ["--lanes" as string]: lanes }}>
        {days.map((d, c) => (
          <Link key={d} className={`cal-wv-day${d === today ? " today" : ""}`} style={{ gridColumn: c + 1 }} href={href({ view: "day", date: d })}>
            <span>{WEEKDAY_TH[c]}</span><b>{Number(d.slice(8))}</b>
          </Link>
        ))}
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
              <AgendaRows items={on} href={href} empty="—" />
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ items, st, href }: { items: CalItem[]; st: State; href: Href }) {
  const on = itemsOn(items, st.date);
  const allDay = on.filter((i) => !i.startTime || i.start !== i.end);
  const timedSameDay = on.filter((i) => i.startTime && i.start === i.end);
  const cols = dayColumns(timedSameDay, st.date);
  const first = Math.min(6, ...timedSameDay.map((i) => Math.floor(minutesOf(i.startTime!) / 60)));
  const last = Math.max(22, ...cols.map((c) => Math.ceil((c.top + c.height) / 60)));
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const PX = 0.9; // px per minute
  return (
    <div className="cal-dayview">
      <div className="cal-allday">
        <span className="cal-allday-label">ทั้งวัน / หลายวัน</span>
        <div className="cal-allday-items">{allDay.length ? allDay.map((i) => <Chip key={i.key} item={i} href={href} showTime={false} />) : <span className="muted small">—</span>}</div>
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

function AgendaView({ items, range, today, href }: { items: CalItem[]; range: { from: string; to: string }; today: string; href: Href }) {
  const days: string[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d);
  const groups = days.map((d) => ({ d, on: itemsOn(items, d).filter((i) => i.start === d || d === range.from) })).filter((g) => g.on.length);
  return (
    <div className="cal-agenda">
      {groups.length === 0 ? (
        <div className="empty-state"><strong>ไม่มีรายการในช่วงนี้</strong><span>ลองเปลี่ยนตัวกรองหรือช่วงเวลา</span></div>
      ) : groups.map((g) => (
        <section key={g.d} className={`cal-ag-day${g.d === today ? " today" : ""}`}>
          <h3>{thaiDate(g.d, { weekday: true, year: true })}{g.d === today ? <small> · วันนี้</small> : null}</h3>
          <AgendaRows items={g.on} href={href} />
        </section>
      ))}
    </div>
  );
}

function AgendaRows({ items, href, empty }: { items: CalItem[]; href: Href; empty?: string }) {
  if (!items.length) return empty ? <p className="muted small cal-empty">{empty}</p> : null;
  return (
    <ul className="cal-rows">
      {items.map((i) => (
        <li key={i.key}>
          <Link className={`cal-row st-${i.status}`} href={href({ item: i.sourceKey, date: i.start })}>
            <span className={`cal-dot tone-${KIND_TONE[i.kind]}`} aria-hidden="true" />
            <span className="cal-row-time">{i.start !== i.end ? `${thaiDate(i.start)}–${thaiDate(i.end)}` : timeLabel(i)}</span>
            <span className="cal-row-main"><span className="cal-row-title">{i.title}</span>
              <span className="cal-row-sub">{KIND_TH[i.kind]}{i.ownerName ? ` · ${i.ownerName}` : ""}</span></span>
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
        <span className={`badge-icon tone-${KIND_TONE[item.kind]}`} aria-hidden="true"><CalendarDays /></span>
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

function Summary({ workload: w, alerts, conflicts, href }: {
  workload: ReturnType<typeof weeklyWorkload>; alerts: Awaited<ReturnType<typeof computeAlerts>>; conflicts: [CalItem, CalItem][]; href: Href;
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
          <div><span>งานทั้งหมด</span><b>{w.total}</b></div>
          <div><span>เสร็จแล้ว</span><b className="ok">{w.done}</b></div>
          <div><span>เกินกำหนด</span><b className={w.overdue ? "bad" : ""}>{w.overdue}</b></div>
          <div><span>รออนุมัติ</span><b>{w.pending}</b></div>
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

        <h3 className="cal-sub-h">สีของรายการ</h3>
        <ul className="cal-legend">
          {(["promotion", "content", "appointment", "stock", "general"] as const).map((k) => <li key={k}><i className={`tone-${KIND_TONE[k]}`} />{k === "general" ? "งาน / รายงาน" : KIND_TH[k]}</li>)}
        </ul>
        <p className="muted small">รายการจากโปรโมชั่น แคมเปญ งานพร้อม Deadline และสต็อกที่ต้องสั่ง ขึ้นอัตโนมัติจากโมดูลต้นทาง</p>
      </div>
    </>
  );
}

export const MANUAL_KIND_LIST = MANUAL_KINDS;
