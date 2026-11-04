/** Master Calendar — pure logic (no DB). Dates are Bangkok calendar days as YYYY-MM-DD, times are HH:MM. */

export type CalKind =
  | "promotion" | "campaign" | "content" | "appointment" | "general" | "task" | "stock" | "court_event" | "report" | "followup";
export type CalStatus = "planned" | "in_progress" | "done" | "cancelled" | "overdue" | "pending_approval";
export type CalSource = "manual" | "task" | "promotion" | "campaign" | "stock";
export type CalView = "month" | "week" | "day" | "agenda";
export type Visibility = "private" | "team" | "executive";
export type Repeat = "none" | "daily" | "weekly" | "monthly";

export type CalItem = {
  key: string;          // unique per occurrence
  sourceKey: string;    // ev:<id> | task:<id> | promo:<id> | camp:<id> | stock:attention
  source: CalSource;
  kind: CalKind;
  title: string;
  shortTitle?: string | null; // Month chips (RCM v1.1 §4.4)
  start: string;        // inclusive
  end: string;          // inclusive
  startTime: string | null;
  endTime: string | null;
  status: CalStatus;
  ownerId: string | null;
  ownerName: string | null;
  createdBy: string | null;
  href: string | null;  // quick action: open the source record
  hrefLabel: string | null;
  editable: boolean;
  details?: string | null;
  linkUrl?: string | null;
  remindMinutes?: number | null;
  repeat?: Repeat;
  repeatUntil?: string | null;
  visibility?: Visibility;
  occurrenceOf?: string; // first-occurrence start date for repeating items
};

/** Manual item kinds offered in the "+ เพิ่มรายการ" form. */
export const MANUAL_KINDS = ["promotion", "content", "appointment", "general", "stock", "court_event", "report", "followup"] as const;
export type ManualKind = (typeof MANUAL_KINDS)[number];

export const KIND_TH: Record<CalKind, string> = {
  promotion: "โปรโมชั่น", campaign: "แคมเปญ", content: "คอนเทนต์", appointment: "นัดหมาย", general: "งานทั่วไป",
  task: "งาน/Deadline", stock: "สต็อก", court_event: "กิจกรรมสนาม", report: "รายงาน KPI", followup: "ติดตามลูกค้า",
};
/** Pastel tones from the RCM: pink = promo, light blue = content, light purple = appointment, light green = stock. */
export const KIND_TONE: Record<CalKind, string> = {
  promotion: "pink", campaign: "pink", content: "blue", appointment: "purple", followup: "purple",
  stock: "green", court_event: "green", general: "amber", task: "amber", report: "amber",
};
export const STATUS_TH: Record<CalStatus, string> = {
  planned: "วางแผน", in_progress: "กำลังทำ", done: "เสร็จ", cancelled: "ยกเลิก", overdue: "เกินกำหนด", pending_approval: "รออนุมัติ",
};
export const REPEAT_TH: Record<Repeat, string> = { none: "ไม่ทำซ้ำ", daily: "รายวัน", weekly: "รายสัปดาห์", monthly: "รายเดือน" };
export const VISIBILITY_TH: Record<Visibility, string> = { private: "ส่วนตัว", team: "ทีม", executive: "ผู้บริหาร" };
export const REMIND_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "เมื่อถึงเวลาเริ่ม" }, { value: 15, label: "ก่อน 15 นาที" }, { value: 30, label: "ก่อน 30 นาที" },
  { value: 60, label: "ก่อน 1 ชั่วโมง" }, { value: 1440, label: "ก่อน 1 วัน" }, { value: 2880, label: "ก่อน 2 วัน" }, { value: 10080, label: "ก่อน 1 สัปดาห์" },
];

export const WEEKDAY_TH = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."]; // Monday-first
const MONTH_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MONTH_TH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function isHhmm(s: unknown): s is string { return typeof s === "string" && HHMM.test(s); }

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
/** 0 = Monday … 6 = Sunday */
export function weekdayMon(iso: string): number { return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7; }
export function weekStart(iso: string): string { return addDays(iso, -weekdayMon(iso)); }
export function monthStart(iso: string): string { return `${iso.slice(0, 8)}01`; }
export function addMonths(iso: string, n: number): string {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + n, d = Number(iso.slice(8, 10));
  const first = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}
export function minutesOf(t: string): number { return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)); }

/** RCM v1.1 DAY-01: /calendar opens the Day view; a deep link with view=… overrides it. */
export function parseView(v: unknown): CalView {
  return v === "week" || v === "month" || v === "agenda" ? v : "day";
}

/** Weeks (Monday-first) covering the month of `date`. */
export function monthWeeks(date: string): string[][] {
  const first = monthStart(date);
  const last = addDays(addMonths(first, 1), -1);
  const weeks: string[][] = [];
  for (let ws = weekStart(first); ws <= last; ws = addDays(ws, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(ws, i)));
  return weeks;
}

export function rangeFor(view: CalView, date: string, agendaDays = 30): { from: string; to: string } {
  if (view === "month") { const w = monthWeeks(date); return { from: w[0][0], to: w[w.length - 1][6] }; }
  if (view === "week") { const ws = weekStart(date); return { from: ws, to: addDays(ws, 6) }; }
  if (view === "day") return { from: date, to: date };
  return { from: date, to: addDays(date, agendaDays - 1) };
}

export function shiftDate(view: CalView, date: string, dir: -1 | 1, agendaDays = 30): string {
  if (view === "month") return addMonths(monthStart(date), dir);
  if (view === "week") return addDays(date, 7 * dir);
  if (view === "day") return addDays(date, dir);
  return addDays(date, agendaDays * dir);
}

export function thaiDate(iso: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = opts.weekday ? `${WEEKDAY_TH[weekdayMon(iso)]} ` : "";
  return `${wd}${d} ${MONTH_TH[m - 1]}${opts.year ? ` ${y + 543}` : ""}`;
}
const WEEKDAY_TH_FULL = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"]; // Monday-first
/** "พุธ, 4 พฤศจิกายน 2569" — date caption of the Day/Month screens (RCM v1.1 UI-G05). */
export function thaiLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAY_TH_FULL[weekdayMon(iso)]}, ${d} ${MONTH_TH_FULL[m - 1]} ${y + 543}`;
}
/** "วันพุธที่ 4 พฤศจิกายน 2569" — accessible day label. */
export function thaiSpokenDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `วัน${WEEKDAY_TH_FULL[weekdayMon(iso)]}ที่ ${d} ${MONTH_TH_FULL[m - 1]} ${y + 543}`;
}
export function monthTitle(iso: string): string {
  return `${MONTH_TH_FULL[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(0, 4)) + 543}`;
}

export function periodLabel(view: CalView, date: string, agendaDays = 30): string {
  const y = (iso: string) => Number(iso.slice(0, 4)) + 543;
  if (view === "month") return `${MONTH_TH_FULL[Number(date.slice(5, 7)) - 1]} ${y(date)}`;
  if (view === "day") return thaiDate(date, { weekday: true, year: true });
  const { from, to } = rangeFor(view, date, agendaDays);
  return `${thaiDate(from)} – ${thaiDate(to, { year: true })}`;
}

/** Occurrences of a (possibly repeating) item that overlap [from, to]. Capped to keep requests bounded. */
export function expandOccurrences<T extends { start: string; end: string; repeat?: Repeat; repeatUntil?: string | null }>(
  item: T, from: string, to: string, cap = 400,
): T[] {
  const len = diffDays(item.start, item.end);
  const repeat = item.repeat ?? "none";
  if (repeat === "none") return item.start <= to && item.end >= from ? [item] : [];
  const until = item.repeatUntil && item.repeatUntil < to ? item.repeatUntil : to;
  const out: T[] = [];
  let i = 0;
  // Jump close to the window for daily/weekly so long-running series stay cheap.
  if (repeat === "daily" || repeat === "weekly") {
    const step = repeat === "daily" ? 1 : 7;
    const skip = Math.max(0, Math.floor((diffDays(item.start, from) - len) / step));
    i = skip;
  }
  for (let guard = 0; guard < cap; guard++, i++) {
    const s = repeat === "daily" ? addDays(item.start, i) : repeat === "weekly" ? addDays(item.start, 7 * i) : addMonths(item.start, i);
    if (repeat === "monthly" && s.slice(8) !== item.start.slice(8)) continue; // e.g. the 31st skips short months
    if (s > until) break;
    const e = addDays(s, len);
    if (e >= from && s <= to) out.push({ ...item, start: s, end: e });
  }
  return out;
}

export type Segment<T> = { item: T; col: number; span: number; lane: number; fromBefore: boolean; toAfter: boolean };

/** Lay out items as continuous bars across a 7-day row (start..start+6). Greedy lanes; longer items first. */
export function layoutWeek<T extends { start: string; end: string; startTime?: string | null; key: string }>(items: T[], ws: string): Segment<T>[] {
  const we = addDays(ws, 6);
  const sorted = items
    .filter((it) => it.start <= we && it.end >= ws)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : diffDays(b.start, b.end) - diffDays(a.start, a.end) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.key.localeCompare(b.key)));
  const laneEnds: number[] = []; // last occupied column per lane
  const out: Segment<T>[] = [];
  for (const item of sorted) {
    const s = item.start < ws ? ws : item.start;
    const e = item.end > we ? we : item.end;
    const col = diffDays(ws, s);
    const end = diffDays(ws, e);
    let lane = laneEnds.findIndex((last) => last < col);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); } else laneEnds[lane] = end;
    out.push({ item, col, span: end - col + 1, lane, fromBefore: item.start < ws, toAfter: item.end > we });
  }
  return out;
}

/** Items occurring on a given day, timed items by start time after all-day ones. */
export function itemsOn<T extends { start: string; end: string; startTime: string | null; title: string }>(items: T[], day: string): T[] {
  return items.filter((i) => i.start <= day && i.end >= day)
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.title.localeCompare(b.title, "th"));
}

type Timed = { key: string; start: string; end: string; startTime: string | null; endTime: string | null; status: CalStatus; title: string; ownerId: string | null };

/** Absolute minute interval for a timed item (end defaults to +60 minutes). */
export function interval(it: Timed, epoch: string): [number, number] | null {
  if (!it.startTime) return null;
  const s = diffDays(epoch, it.start) * 1440 + minutesOf(it.startTime);
  let e = diffDays(epoch, it.end) * 1440 + (it.endTime ? minutesOf(it.endTime) : minutesOf(it.startTime) + 60);
  if (e <= s) e = s + 60;
  return [s, e];
}

/** Pairs of timed items whose times overlap (cancelled/done items ignored). Task deadlines are points in time,
 *  not blocks of time, so they never count as a clash. */
export function findConflicts<T extends Timed & { source?: CalSource }>(items: T[]): [T, T][] {
  const live = items.filter((i) => i.startTime && i.source !== "task" && i.status !== "cancelled" && i.status !== "done");
  if (!live.length) return [];
  const epoch = live.reduce((m, i) => (i.start < m ? i.start : m), live[0].start);
  const withIv = live.map((i) => ({ i, iv: interval(i, epoch)! })).sort((a, b) => a.iv[0] - b.iv[0]);
  const out: [T, T][] = [];
  for (let a = 0; a < withIv.length; a++) {
    for (let b = a + 1; b < withIv.length && withIv[b].iv[0] < withIv[a].iv[1]; b++) out.push([withIv[a].i, withIv[b].i]);
  }
  return out;
}

/** Side-by-side columns for overlapping timed items in the Day view. */
export function dayColumns<T extends Timed>(items: T[], day: string): { item: T; top: number; height: number; col: number; cols: number }[] {
  const timed = items.filter((i) => i.startTime).map((i) => {
    const iv = interval(i, day)!;
    return { item: i, s: Math.max(0, iv[0]), e: Math.min(1440, iv[1]) };
  }).filter((x) => x.e > x.s).sort((a, b) => a.s - b.s || b.e - a.e);
  const res: { item: T; top: number; height: number; col: number; cols: number }[] = [];
  let cluster: typeof timed = []; let clusterEnd = -1;
  const flush = () => {
    const colEnds: number[] = [];
    const placed = cluster.map((x) => {
      let c = colEnds.findIndex((end) => end <= x.s);
      if (c === -1) { c = colEnds.length; colEnds.push(x.e); } else colEnds[c] = x.e;
      return { x, c };
    });
    for (const { x, c } of placed) res.push({ item: x.item, top: x.s, height: x.e - x.s, col: c, cols: colEnds.length });
    cluster = []; clusterEnd = -1;
  };
  for (const x of timed) {
    if (cluster.length && x.s >= clusterEnd) flush();
    cluster.push(x); clusterEnd = Math.max(clusterEnd, x.e);
  }
  if (cluster.length) flush();
  return res;
}

export type Workload = {
  from: string; to: string; total: number; done: number; overdue: number; pending: number;
  perDay: { date: string; count: number }[]; busiest: { date: string; count: number } | null;
};

/** Weekly workload (RCM §D): work items in the week — promotions/campaigns count only when awaiting approval. */
export function weeklyWorkload(items: CalItem[], date: string): Workload {
  const from = weekStart(date), to = addDays(from, 6);
  const inWeek = items.filter((i) => i.start <= to && i.end >= from && i.status !== "cancelled" && i.source !== "stock")
    .filter((i) => !(i.source === "promotion" || i.source === "campaign") || i.status === "pending_approval");
  const perDay = Array.from({ length: 7 }, (_, k) => {
    const d = addDays(from, k);
    return { date: d, count: inWeek.filter((i) => i.start <= d && i.end >= d).length };
  });
  const max = perDay.reduce((m, d) => (d.count > m.count ? d : m), perDay[0]);
  return {
    from, to, total: inWeek.length,
    done: inWeek.filter((i) => i.status === "done").length,
    overdue: inWeek.filter((i) => i.status === "overdue").length,
    pending: inWeek.filter((i) => i.status === "pending_approval").length,
    perDay, busiest: max.count > 0 ? max : null,
  };
}

/** Manual kinds whose unfinished past items count as overdue (appointments in the past simply happened). */
const WORK_KINDS: CalKind[] = ["general", "report", "followup", "content", "stock"];
export function manualStatus(kind: CalKind, status: CalStatus, end: string, today: string): CalStatus {
  if ((status === "planned" || status === "in_progress") && end < today && WORK_KINDS.includes(kind)) return "overdue";
  return status;
}

export type Filters = { kinds: CalKind[]; owner: string | null; status: CalStatus | null; mine: boolean; q: string };

export function applyFilters(items: CalItem[], f: Filters, me: string): CalItem[] {
  const q = f.q.trim().toLowerCase();
  return items.filter((i) =>
    (!f.kinds.length || f.kinds.includes(i.kind)) &&
    (!f.owner || i.ownerId === f.owner) &&
    (!f.status || i.status === f.status) &&
    (!f.mine || i.ownerId === me || (i.ownerId === null && i.createdBy === me)) &&
    (!q || i.title.toLowerCase().includes(q) || (i.details ?? "").toLowerCase().includes(q)));
}

export function timeLabel(i: { startTime: string | null; endTime: string | null }): string {
  if (!i.startTime) return "ทั้งวัน";
  return i.endTime ? `${i.startTime}–${i.endTime}` : i.startTime;
}

export type EventInput = {
  title: string; shortTitle: string | null; kind: ManualKind; start: string; end: string; allDay: boolean; startTime: string | null; endTime: string | null;
  repeat: Repeat; repeatUntil: string | null; ownerId: string | null; status: Exclude<CalStatus, "overdue" | "pending_approval">;
  remindMinutes: number | null; details: string | null; linkUrl: string | null; visibility: Visibility;
};

/** Validates the "+ เพิ่มรายการ" form. Returns a Thai error message or the normalized input. */
export function validateEventInput(f: Record<string, string>, opts: { memberIds: string[]; canFollowup: boolean }): { error: string } | { value: EventInput } {
  const title = (f.title ?? "").trim();
  if (!title) return { error: "กรุณากรอกชื่อรายการ" };
  if (title.length > 160) return { error: "ชื่อรายการยาวเกิน 160 ตัวอักษร" };
  const shortTitle = (f.shortTitle ?? "").trim() || null;
  if (shortTitle && shortTitle.length > 24) return { error: "ชื่อย่อยาวเกิน 24 ตัวอักษร" };
  const kind = f.kind as ManualKind;
  if (!(MANUAL_KINDS as readonly string[]).includes(kind)) return { error: "กรุณาเลือกประเภท" };
  if (kind === "followup" && !opts.canFollowup) return { error: "ไม่มีสิทธิ์สร้างนัดติดตามลูกค้า" };
  const start = f.startDate ?? "";
  if (!isIsoDate(start)) return { error: "กรุณาเลือกวันที่เริ่ม" };
  const end = f.endDate ? f.endDate : start;
  if (!isIsoDate(end)) return { error: "วันที่สิ้นสุดไม่ถูกต้อง" };
  if (end < start) return { error: "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม" };
  if (diffDays(start, end) > 366) return { error: "ช่วงเวลายาวเกิน 1 ปี" };
  const allDay = f.allDay === "on";
  let startTime: string | null = null, endTime: string | null = null;
  if (!allDay) {
    if (!isHhmm(f.startTime)) return { error: "กรุณาระบุเวลาเริ่ม หรือเลือก “ทั้งวัน”" };
    startTime = f.startTime;
    if (f.endTime) {
      if (!isHhmm(f.endTime)) return { error: "เวลาสิ้นสุดไม่ถูกต้อง" };
      endTime = f.endTime;
      if (start === end && minutesOf(endTime) <= minutesOf(startTime)) return { error: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม" };
    }
  }
  const repeat = (f.repeat || "none") as Repeat;
  if (!["none", "daily", "weekly", "monthly"].includes(repeat)) return { error: "รูปแบบการทำซ้ำไม่ถูกต้อง" };
  let repeatUntil: string | null = null;
  if (repeat !== "none" && f.repeatUntil) {
    if (!isIsoDate(f.repeatUntil) || f.repeatUntil < start) return { error: "วันที่สิ้นสุดการทำซ้ำต้องไม่ก่อนวันที่เริ่ม" };
    repeatUntil = f.repeatUntil;
  }
  const ownerId = f.ownerId || null;
  if (ownerId && !opts.memberIds.includes(ownerId)) return { error: "ผู้รับผิดชอบต้องเป็นสมาชิกทีม" };
  const status = (f.status || "planned") as EventInput["status"];
  if (!["planned", "in_progress", "done", "cancelled"].includes(status)) return { error: "สถานะไม่ถูกต้อง" };
  let remindMinutes: number | null = null;
  if (f.remind !== undefined && f.remind !== "") {
    const n = Number(f.remind);
    if (!REMIND_OPTIONS.some((o) => o.value === n)) return { error: "ตัวเลือกแจ้งเตือนไม่ถูกต้อง" };
    remindMinutes = n;
  }
  const details = (f.details ?? "").trim() || null;
  if (details && details.length > 4000) return { error: "รายละเอียดยาวเกิน 4,000 ตัวอักษร" };
  let linkUrl: string | null = (f.linkUrl ?? "").trim() || null;
  if (linkUrl) {
    try {
      const u = new URL(linkUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
      if (linkUrl.length > 500) return { error: "ลิงก์ยาวเกิน 500 ตัวอักษร" };
      linkUrl = u.toString();
    } catch { return { error: "ลิงก์ต้องขึ้นต้นด้วย https://" }; }
  }
  const visibility = (f.visibility || "team") as Visibility;
  if (!["private", "team", "executive"].includes(visibility)) return { error: "ความเป็นส่วนตัวไม่ถูกต้อง" };
  return { value: { title, shortTitle, kind, start, end, allDay, startTime, endTime, repeat, repeatUntil, ownerId, status, remindMinutes, details, linkUrl, visibility } };
}
