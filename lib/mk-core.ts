/** MK approvals — pure helpers (no I/O). Shared by server code, client components and unit tests. */
import { addDays, diffDays, isHhmm, isIsoDate, thaiDate } from "./calendar-core.ts";

export type MkKind = "ad" | "influencer" | "promotion" | "other";
export type MkStatus = "pending" | "approved" | "returned";
export type MkPlatform = "tiktok" | "instagram" | "youtube" | "facebook" | "other";
export type MkTab = "pending" | "approved" | "returned";

export const MK_KINDS: MkKind[] = ["ad", "influencer", "promotion", "other"];
export const KIND_LABEL: Record<MkKind, string> = { ad: "ยิงแอด", influencer: "อินฟลูเอนเซอร์", promotion: "โปรโมชัน", other: "อื่น ๆ" };
export const KIND_SHORT: Record<MkKind, string> = { ad: "ยิงแอด", influencer: "อินฟลู", promotion: "โปรโมชัน", other: "อื่น ๆ" };
export const STATUS_LABEL: Record<MkStatus, string> = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", returned: "ส่งกลับแก้ไข" };
export const PLATFORM_LABEL: Record<MkPlatform, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", facebook: "Facebook", other: "อื่น ๆ" };
export const PLATFORMS: MkPlatform[] = ["tiktok", "instagram", "youtube", "facebook", "other"];

export const REPEAT_OPTIONS = [
  { value: "none", label: "ไม่" }, { value: "daily", label: "ทุกวัน" }, { value: "weekly", label: "ทุกสัปดาห์" },
  { value: "biweekly", label: "ทุก 2 สัปดาห์" }, { value: "monthly", label: "ทุกเดือน" }, { value: "yearly", label: "ทุกปี" },
] as const;
export const TRAVEL_OPTIONS = [
  { value: 0, label: "ไม่มี" }, { value: 15, label: "15 นาที" }, { value: 30, label: "30 นาที" },
  { value: 60, label: "1 ชั่วโมง" }, { value: 90, label: "1 ชั่วโมง 30 นาที" }, { value: 120, label: "2 ชั่วโมง" },
] as const;
export const REMIND_BEFORE_OPTIONS = [
  { value: "none", label: "ไม่มี" }, { value: "same_day", label: "ในวันกำหนด" }, { value: "1d", label: "ก่อน 1 วัน" },
  { value: "2d", label: "ก่อน 2 วัน" }, { value: "1w", label: "ก่อน 1 สัปดาห์" },
] as const;
export const CALENDAR_LISTS = [
  { value: "marketing", label: "การตลาด" }, { value: "content", label: "คอนเทนต์" },
  { value: "promotion", label: "โปรโมชัน" }, { value: "general", label: "ทั่วไป" },
] as const;
export const PRIORITY_OPTIONS = [
  { value: "low", label: "ต่ำ" }, { value: "normal", label: "ปกติ" }, { value: "high", label: "สูง" },
] as const;

/** Promotion bars on the calendar: one colour per promotion, cycling. Not pink (pink marks request dots). */
export const PROMO_COLORS = ["#4cae6a", "#e59a52", "#6fa9dc", "#a98fd6", "#d9a03f", "#5bb4b0"];

export const refLabel = (n: number) => `#REQ-${String(n).padStart(4, "0")}`;

export function parseTab(v: unknown): MkTab {
  return v === "approved" || v === "returned" ? v : "pending";
}
export function parseKind(v: unknown): MkKind | null {
  return typeof v === "string" && (MK_KINDS as string[]).includes(v) ? (v as MkKind) : null;
}
export function parseRange(from: unknown, to: unknown): { from: string; to: string } | null {
  if (!isIsoDate(from) || !isIsoDate(to)) return null;
  if (to < from) return null;
  if (diffDays(from, to) > 366) return null;
  return { from, to };
}

/** "฿15,000" from satang; null → "". */
export function baht(satang: number | null | undefined): string {
  if (satang === null || satang === undefined) return "";
  return `฿${Math.round(satang / 100).toLocaleString("en-US")}`;
}
/** "6,000" / "6000" / "฿6,000.50" → satang; "" → null; invalid → NaN. */
export function parseBahtToSatang(raw: string): number | null {
  const s = raw.replace(/[฿,\s]/g, "");
  if (!s) return null;
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}
export function compactCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}

/** "12 พ.ย. 2569" style short date with Buddhist year. */
export const thaiShort = (iso: string, year = false) => thaiDate(iso, { year });

/** "15–28 พ.ย. 2569", "15 พ.ย.–15 ธ.ค. 2569", "28 ธ.ค. 2569–3 ม.ค. 2570". */
export function thaiRange(from: string, to: string): string {
  if (from === to) return thaiDate(from, { year: true });
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const sameMonth = sameYear && from.slice(5, 7) === to.slice(5, 7);
  if (sameMonth) return `${Number(from.slice(8, 10))}–${thaiDate(to, { year: true })}`;
  if (sameYear) return `${thaiDate(from)}–${thaiDate(to, { year: true })}`;
  return `${thaiDate(from, { year: true })}–${thaiDate(to, { year: true })}`;
}

/** Due label relative to today: "ภายในวันนี้", "ภายในพรุ่งนี้ 9 พ.ย.", "เลยกำหนด 2 วัน", "ภายใน 12 พ.ย.". */
export function dueLabel(due: string, today: string): { text: string; urgent: boolean; overdue: boolean } {
  const d = diffDays(today, due);
  if (d < 0) return { text: `เลยกำหนด ${-d} วัน`, urgent: true, overdue: true };
  if (d === 0) return { text: "ภายในวันนี้", urgent: true, overdue: false };
  if (d === 1) return { text: `ภายในพรุ่งนี้ ${thaiDate(due)}`, urgent: true, overdue: false };
  return { text: `ภายใน ${thaiDate(due)}`, urgent: false, overdue: false };
}
export function daysLeftLabel(due: string, today: string): string {
  const d = diffDays(today, due);
  if (d < 0) return `เลยกำหนด ${-d} วัน`;
  if (d === 0) return "วันนี้";
  return `อีก ${d} วัน`;
}

/** Overview grouping: due within the current Sun–Sat week (or overdue) vs later. */
export function weekEndSunFirst(today: string): string {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(today, 6 - dow);
}

// ---------------------------------------------------------------- month grid (Sunday-first, per the approved design)
export function monthCells(month: string): (string | null)[][] {
  const first = `${month.slice(0, 7)}-01`;
  const dow = new Date(`${first}T00:00:00Z`).getUTCDay();
  const next = new Date(`${first}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const days = Math.round((next.getTime() - new Date(`${first}T00:00:00Z`).getTime()) / 86_400_000);
  const cells: (string | null)[] = [...Array(dow).fill(null), ...Array.from({ length: days }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
export function shiftMonth(month: string, n: number): string {
  const d = new Date(`${month.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
const MONTH_LONG = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const monthLong = (iso: string) => `${MONTH_LONG[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(0, 4)) + 543}`;
export const WEEKDAYS_SUN = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const WEEKDAY_LONG = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
export const weekdayLong = (iso: string) => WEEKDAY_LONG[new Date(`${iso}T00:00:00Z`).getUTCDay()];

export type PromoSpan = { key: string; name: string; start: string; end: string; color: string };
export type PromoBar = { key: string; name: string; color: string; col: number; span: number; lane: number; startsHere: boolean; endsHere: boolean };

/** Bars for one week row: promotions overlapping the week, stacked in lanes (first fit). */
export function promoBars(week: (string | null)[], promos: PromoSpan[]): PromoBar[] {
  const days = week.filter((d): d is string => !!d);
  if (!days.length) return [];
  const ws = days[0], we = days[days.length - 1];
  const lanesEnd: number[] = [];
  const out: PromoBar[] = [];
  const overlapping = promos.filter((p) => p.start <= we && p.end >= ws).sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  for (const p of overlapping) {
    const a = p.start > ws ? p.start : ws;
    const b = p.end < we ? p.end : we;
    const col = week.indexOf(a);
    const span = week.indexOf(b) - col + 1;
    let lane = lanesEnd.findIndex((end) => end < col);
    if (lane === -1) { lane = lanesEnd.length; lanesEnd.push(-1); }
    lanesEnd[lane] = col + span - 1;
    out.push({ key: p.key, name: p.name, color: p.color, col, span, lane, startsHere: a === p.start, endsHere: b === p.end });
  }
  return out;
}

// ---------------------------------------------------------------- request input (team form)
export type PersonInput = {
  name: string; platform: MkPlatform; handle: string | null; followers: number | null; feeSatang: number | null;
  avgViews: number | null; engagementBps: number | null; audience: string | null; deliverables: string | null;
  deliverBy: string | null; conditions: string | null; fitNote: string | null; photoUrl: string | null; profileUrl: string | null;
};
export type AttachmentInput = { kind: "image" | "file" | "link"; label: string; url: string };
export type RequestInput = {
  kind: MkKind; title: string; summary: string; amountSatang: number | null; channel: string | null;
  goal: string | null; adCopy: string | null; plan: string | null; discountText: string | null; conditions: string | null;
  startsOn: string | null; endsOn: string | null; allDay: boolean; startTime: string | null; endTime: string | null;
  decideBy: string; urgent: boolean; travelMinutes: number; repeat: string; remindOn: string | null; remindTime: string | null;
  remindBefore: string; remindLocation: boolean; remindMessaging: boolean; calendarList: string; invitees: string | null;
  tags: string[]; flagged: boolean; priority: string; note: string | null; linkUrl: string | null;
  attachments: AttachmentInput[]; people: PersonInput[];
};

const opt = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};
const on = (v: unknown) => v === "on" || v === "true" || v === "1";
const intOrNull = (v: unknown) => {
  const s = typeof v === "string" ? v.replace(/[,\s]/g, "") : "";
  if (!s) return null;
  return /^\d{1,10}$/.test(s) ? Number(s) : NaN;
};
const httpsUrl = (s: string) => /^https:\/\/[^\s]+$/.test(s) && s.length <= 2000;

/** Validates the team form. `f` is a flat map of field name → string (repeating groups use name.N). */
export function validateRequestInput(f: Record<string, string>): { value: RequestInput } | { error: string; field?: string } {
  const kind = parseKind(f.kind);
  if (!kind) return { error: "เลือกประเภทคำขอ", field: "kind" };
  const title = (f.title ?? "").trim();
  if (!title) return { error: "กรอกชื่อคำขอ", field: "title" };
  if (title.length > 160) return { error: "ชื่อคำขอยาวเกิน 160 ตัวอักษร", field: "title" };
  const summary = (f.summary ?? "").trim();
  if (!summary) return { error: "กรอกสิ่งที่ขออนุมัติ", field: "summary" };
  if (summary.length > 2000) return { error: "สิ่งที่ขออนุมัติยาวเกิน 2,000 ตัวอักษร", field: "summary" };
  const amount = parseBahtToSatang(f.amount ?? "");
  if (Number.isNaN(amount)) return { error: "งบประมาณต้องเป็นตัวเลข เช่น 6,000", field: "amount" };
  if (!isIsoDate(f.decide_by)) return { error: "เลือกวันกำหนดตัดสินใจ", field: "decide_by" };

  const startsOn = isIsoDate(f.starts_on) ? f.starts_on : null;
  const endsOn = isIsoDate(f.ends_on) ? f.ends_on : startsOn;
  if (f.starts_on && !startsOn) return { error: "วันเริ่มไม่ถูกต้อง", field: "starts_on" };
  if (startsOn && endsOn && endsOn < startsOn) return { error: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม", field: "ends_on" };
  const allDay = on(f.all_day) || !startsOn;
  const startTime = !allDay && isHhmm(f.start_time) ? f.start_time : null;
  const endTime = !allDay && startTime && isHhmm(f.end_time) ? f.end_time : null;
  if (!allDay && !startTime) return { error: "เลือกเวลาเริ่ม หรือเปิด “ทั้งวัน”", field: "start_time" };
  if (startTime && endTime && startsOn === endsOn && endTime <= startTime) return { error: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม", field: "end_time" };

  const remind = on(f.remind);
  const remindOn = remind && isIsoDate(f.remind_on) ? f.remind_on : null;
  if (remind && !remindOn) return { error: "เลือกวันที่จะให้เตือน หรือปิด “ตั้งเตือน”", field: "remind_on" };
  const remindTime = remindOn && isHhmm(f.remind_time) ? f.remind_time : null;

  const travel = Number(f.travel_minutes ?? 0);
  const travelMinutes = TRAVEL_OPTIONS.some((o) => o.value === travel) ? travel : 0;
  const repeat = REPEAT_OPTIONS.some((o) => o.value === f.repeat) ? f.repeat : "none";
  const remindBefore = REMIND_BEFORE_OPTIONS.some((o) => o.value === f.remind_before) ? f.remind_before : "none";
  const calendarList = CALENDAR_LISTS.some((o) => o.value === f.calendar_list) ? f.calendar_list : "marketing";
  const priority = PRIORITY_OPTIONS.some((o) => o.value === f.priority) ? f.priority : "normal";
  const tags = [...new Set((f.tags ?? "").split(/[,\n]/).map((t) => t.trim().replace(/^#?/, "#")).filter((t) => t.length > 1 && t.length <= 40))].slice(0, 12);
  const linkUrl = opt(f.link_url, 2000);
  if (linkUrl && !/^https?:\/\/[^\s]+$/.test(linkUrl)) return { error: "URL ต้องขึ้นต้นด้วย http:// หรือ https://", field: "link_url" };

  const attachments: AttachmentInput[] = [];
  for (let i = 0; i < 12; i++) {
    const url = (f[`att_url.${i}`] ?? "").trim();
    if (!url) continue;
    if (!httpsUrl(url)) return { error: `ไฟล์แนบที่ ${i + 1}: ลิงก์ต้องขึ้นต้นด้วย https://`, field: `att_url.${i}` };
    const k = f[`att_kind.${i}`];
    const kindA = k === "image" || k === "file" ? k : "link";
    const label = ((f[`att_label.${i}`] ?? "").trim() || url.split("/").pop() || "ไฟล์แนบ").slice(0, 160);
    attachments.push({ kind: kindA, label, url });
  }

  const people: PersonInput[] = [];
  if (kind === "influencer") {
    for (let i = 0; i < 20; i++) {
      const name = (f[`p_name.${i}`] ?? "").trim();
      if (!name) continue;
      const platform = (PLATFORMS as string[]).includes(f[`p_platform.${i}`]) ? (f[`p_platform.${i}`] as MkPlatform) : "other";
      const followers = intOrNull(f[`p_followers.${i}`]);
      const avgViews = intOrNull(f[`p_views.${i}`]);
      const fee = parseBahtToSatang(f[`p_fee.${i}`] ?? "");
      const engRaw = (f[`p_eng.${i}`] ?? "").replace("%", "").trim();
      const eng = engRaw ? Math.round(Number(engRaw) * 100) : null;
      if ([followers, avgViews, fee].some((x) => Number.isNaN(x)) || (eng !== null && (Number.isNaN(eng) || eng < 0 || eng > 10000))) {
        return { error: `อินฟลูเอนเซอร์ “${name}”: ตัวเลขไม่ถูกต้อง`, field: `p_name.${i}` };
      }
      const photo = opt(f[`p_photo.${i}`], 2000);
      const profile = opt(f[`p_profile.${i}`], 2000);
      if ((photo && !httpsUrl(photo)) || (profile && !httpsUrl(profile))) return { error: `อินฟลูเอนเซอร์ “${name}”: ลิงก์ต้องขึ้นต้นด้วย https://`, field: `p_name.${i}` };
      people.push({
        name: name.slice(0, 120), platform, handle: opt(f[`p_handle.${i}`], 80), followers, feeSatang: fee, avgViews,
        engagementBps: eng, audience: opt(f[`p_audience.${i}`], 200), deliverables: opt(f[`p_deliver.${i}`], 200),
        deliverBy: isIsoDate(f[`p_deliver_by.${i}`]) ? f[`p_deliver_by.${i}`] : null, conditions: opt(f[`p_cond.${i}`], 1000),
        fitNote: opt(f[`p_fit.${i}`], 1000), photoUrl: photo, profileUrl: profile,
      });
    }
    if (!people.length) return { error: "เพิ่มอินฟลูเอนเซอร์อย่างน้อย 1 คน", field: "p_name.0" };
  }
  const peopleFee = people.reduce((s, p) => s + (p.feeSatang ?? 0), 0);

  return {
    value: {
      kind, title, summary, amountSatang: kind === "influencer" && amount === null && peopleFee > 0 ? peopleFee : amount,
      channel: opt(f.channel, 120), goal: opt(f.goal, 2000), adCopy: opt(f.ad_copy, 2000), plan: opt(f.plan, 4000),
      discountText: opt(f.discount_text, 120), conditions: opt(f.conditions, 2000),
      startsOn, endsOn: startsOn ? endsOn : null, allDay, startTime, endTime, decideBy: f.decide_by, urgent: on(f.urgent),
      travelMinutes, repeat, remindOn, remindTime, remindBefore, remindLocation: on(f.remind_location), remindMessaging: on(f.remind_messaging),
      calendarList, invitees: opt(f.invitees, 400), tags, flagged: on(f.flagged), priority, note: opt(f.note, 4000), linkUrl,
      attachments, people,
    },
  };
}

/** Comment / return-reason text: trimmed, 1–2000 chars. */
export function cleanText(v: unknown, max = 2000): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s.length <= max ? s : null;
}

// ---------------------------------------------------------------- Bangkok time labels
const BKK = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** Date → { date: "YYYY-MM-DD", time: "HH:MM" } in Asia/Bangkok. */
export function bkkParts(d: Date): { date: string; time: string } {
  const p = Object.fromEntries(BKK.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
/** "6 พ.ย. 2569 · 14:20 น." */
export function thaiStamp(d: Date, year = true): string {
  const { date, time } = bkkParts(d);
  return `${thaiDate(date, { year })} · ${time} น.`;
}
/** Notification time: "เมื่อสักครู่", "9 นาทีที่แล้ว", "1 ชม.ที่แล้ว", "เมื่อวาน 18:10 น.", "6 พ.ย. 14:20 น." */
export function relTime(d: Date, now: Date = new Date()): string {
  const mins = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const a = bkkParts(d), b = bkkParts(now);
  if (a.date === b.date) return `${Math.floor(mins / 60)} ชม.ที่แล้ว`;
  if (addDays(a.date, 1) === b.date) return `เมื่อวาน ${a.time} น.`;
  return `${thaiDate(a.date)} ${a.time} น.`;
}
/** First letter for avatars ("คุณมิ้นท์" → "มิ"). Thai leading vowels/tone marks are kept with their consonant. */
export function initialsOf(name: string): string {
  const s = name.replace(/^คุณ\s*/, "").trim();
  if (!s) return "?";
  const m = s.match(/^[\u0E40-\u0E44]?[\u0E01-\u0E2E][\u0E31\u0E34-\u0E3A]?/);
  return m ? m[0] : s.slice(0, 1).toUpperCase();
}
