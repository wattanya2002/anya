/** Thai public holidays, festivals and observances shown in the Master Calendar (read-only reference data, no DB).
 *
 *  Sources (checked 2026-11-04):
 *  - 2569 (2026): cabinet holiday calendar for 2569 + BOT bank holidays (incl. the extra holiday Fri 2 Jan 2569, ครม. 12 พ.ย. 2567).
 *  - 2570 (2027): Bank of Thailand announcement 37/2569 (ราชกิจจานุเบกษา 25 ส.ค. 2569); government-only days marked pending
 *    where the cabinet has not yet decided.
 *  - Festivals / observances (Chinese New Year, Loy Krathong, Ok Phansa, vegetarian festival, …) from Thai calendar publications.
 *  Lunar dates change every year, so a new year must be added here once the official announcement exists. */

export type HolidayType = "holiday" | "festival" | "observance";
/** all = government + banks; gov = government offices only; bank = banks (and most private firms) only */
export type DayOff = "all" | "gov" | "bank" | null;
export type ThemeKey =
  | "newyear" | "songkran" | "buddhist" | "king" | "queen" | "mother" | "father" | "royal" | "memorial" | "labour"
  | "constitution" | "cny" | "valentine" | "loykrathong" | "halloween" | "christmas" | "children" | "teacher" | "vegetarian";

export type HolidayTheme = {
  icon: ThemeKey;
  /** colour of the day / festival, as Thai people know it */
  colorTh: string;
  bg: string;   // pastel cell tint
  fg: string;   // icon / text colour
  dot: string;  // dot on the compact iPhone month
  why: string;  // one line on why this colour
};

export const THEMES: Record<ThemeKey, HolidayTheme> = {
  newyear:      { icon: "newyear", colorTh: "ทอง", bg: "#fff4d6", fg: "#a8700f", dot: "#f2c14e", why: "สีทองแห่งความรุ่งเรือง ต้อนรับปีใหม่" },
  songkran:     { icon: "songkran", colorTh: "ฟ้า (สายน้ำ)", bg: "#e3f3fd", fg: "#2477b3", dot: "#5bb4ec", why: "สีของน้ำ รดน้ำดำหัว เล่นน้ำสงกรานต์" },
  buddhist:     { icon: "buddhist", colorTh: "เหลืองส้ม (จีวร)", bg: "#fff0dc", fg: "#b45f0e", dot: "#f0a043", why: "สีจีวรพระสงฆ์ สำหรับวันสำคัญทางพุทธศาสนา" },
  king:         { icon: "king", colorTh: "เหลือง", bg: "#fff6cc", fg: "#8c6d00", dot: "#f2cf3a", why: "สีประจำวันจันทร์ วันพระราชสมภพของในหลวงรัชกาลที่ 10" },
  queen:        { icon: "queen", colorTh: "ม่วง", bg: "#f1eafb", fg: "#6c48a8", dot: "#a985dc", why: "สีประจำวันเสาร์ วันพระราชสมภพของสมเด็จพระราชินี" },
  mother:       { icon: "mother", colorTh: "ฟ้า (ดอกมะลิ)", bg: "#e6f1fc", fg: "#336fae", dot: "#7fb6ea", why: "สีประจำวันศุกร์ของพระพันปีหลวง และดอกมะลิสัญลักษณ์วันแม่" },
  father:       { icon: "father", colorTh: "เหลือง (ดอกพุทธรักษา)", bg: "#fff6cc", fg: "#8c6d00", dot: "#f2cf3a", why: "สีประจำวันจันทร์ของในหลวงรัชกาลที่ 9 และดอกพุทธรักษาสัญลักษณ์วันพ่อ" },
  royal:        { icon: "royal", colorTh: "ทอง", bg: "#fbf1dc", fg: "#93681f", dot: "#d9a84e", why: "สีทองของพระราชพิธีและวันสำคัญของชาติ" },
  memorial:     { icon: "memorial", colorTh: "ขาว-ดำ (ไว้อาลัย)", bg: "#eef0f3", fg: "#4b5563", dot: "#8a929e", why: "วันรำลึก จึงใช้โทนสงบ ไม่ใช้สีสด" },
  labour:       { icon: "labour", colorTh: "น้ำเงิน", bg: "#e5ecf8", fg: "#35548f", dot: "#7090c8", why: "สีของชุดทำงาน ยกย่องผู้ใช้แรงงาน" },
  constitution: { icon: "constitution", colorTh: "แดง ขาว น้ำเงิน (ธงชาติ)", bg: "#edf0fa", fg: "#2d4a8a", dot: "#3d5aa8", why: "สีธงชาติไทย" },
  cny:          { icon: "cny", colorTh: "แดง-ทอง", bg: "#fde5e5", fg: "#b42f2f", dot: "#e45656", why: "สีแดงนำโชค ทองแห่งความมั่งคั่ง ตามธรรมเนียมจีน" },
  valentine:    { icon: "valentine", colorTh: "ชมพู-แดง", bg: "#fde6ee", fg: "#c8346a", dot: "#f0709c", why: "สีแห่งความรัก" },
  loykrathong:  { icon: "loykrathong", colorTh: "น้ำเงินคืนเพ็ญ-ทอง", bg: "#e6ebf8", fg: "#34478f", dot: "#6c82d0", why: "ท้องฟ้าคืนพระจันทร์เต็มดวง กับแสงเทียนบนกระทง" },
  halloween:    { icon: "halloween", colorTh: "ส้ม-ม่วง", bg: "#fdebdc", fg: "#b6561a", dot: "#f08a3c", why: "สีฟักทองกับค่ำคืนฮาโลวีน" },
  christmas:    { icon: "christmas", colorTh: "เขียว-แดง", bg: "#e3f4e8", fg: "#277a42", dot: "#4cae6a", why: "สีต้นคริสต์มาสและซานตาคลอส" },
  children:     { icon: "children", colorTh: "หลากสี", bg: "#eaf6ff", fg: "#2378b8", dot: "#5bb4ec", why: "สีสันสดใสของเด็ก ๆ" },
  teacher:      { icon: "teacher", colorTh: "เขียว (ดอกเข็ม)", bg: "#e8f6f1", fg: "#277a62", dot: "#56b493", why: "ดอกเข็ม หญ้าแพรก และดอกมะเขือ เครื่องไหว้ครู" },
  vegetarian:   { icon: "vegetarian", colorTh: "เหลือง-แดง (ธงเจ)", bg: "#fff6cc", fg: "#b42f2f", dot: "#f2cf3a", why: "ธงเหลืองตัวอักษรแดงของร้านอาหารเจ" },
};

export type Holiday = {
  date: string;            // YYYY-MM-DD (CE), Bangkok calendar day
  end?: string;            // inclusive, for multi-day festivals
  name: string;
  type: HolidayType;
  off: DayOff;
  theme: ThemeKey;
  note?: string;
  pending?: boolean;       // awaiting cabinet decision
};

/** Years (CE) with checked data. Views outside these years show a notice instead of guessing. */
export const HOLIDAY_YEARS = [2026, 2027] as const;

const H = (date: string, name: string, type: HolidayType, off: DayOff, theme: ThemeKey, extra: Partial<Holiday> = {}): Holiday =>
  ({ date, name, type, off, theme, ...extra });

export const HOLIDAYS: Holiday[] = [
  // ---------------------------------------------------------------- 2569 (2026)
  H("2026-01-01", "วันขึ้นปีใหม่", "holiday", "all", "newyear"),
  H("2026-01-02", "วันหยุดพิเศษช่วงปีใหม่", "holiday", "all", "newyear", { note: "วันหยุดราชการเพิ่มเป็นกรณีพิเศษ ตามมติ ครม." }),
  H("2026-01-10", "วันเด็กแห่งชาติ", "observance", null, "children", { note: "วันเสาร์ที่สองของเดือนมกราคม" }),
  H("2026-01-16", "วันครู", "observance", null, "teacher"),
  H("2026-02-14", "วันวาเลนไทน์", "festival", null, "valentine"),
  H("2026-02-17", "วันตรุษจีน", "festival", null, "cny", { note: "วันจ่าย 15 ก.พ. · วันไหว้ 16 ก.พ. · วันเที่ยว 17 ก.พ." }),
  H("2026-03-03", "วันมาฆบูชา", "holiday", "all", "buddhist"),
  H("2026-04-06", "วันจักรี", "holiday", "all", "royal"),
  H("2026-04-13", "เทศกาลสงกรานต์", "holiday", "all", "songkran", { end: "2026-04-15" }),
  H("2026-05-01", "วันแรงงานแห่งชาติ", "holiday", "bank", "labour", { note: "หน่วยงานราชการเปิดทำการตามปกติ" }),
  H("2026-05-04", "วันฉัตรมงคล", "holiday", "all", "royal"),
  H("2026-05-31", "วันวิสาขบูชา", "holiday", "all", "buddhist"),
  H("2026-06-01", "ชดเชยวันวิสาขบูชา", "holiday", "all", "buddhist"),
  H("2026-06-03", "วันเฉลิมพระชนมพรรษา สมเด็จพระราชินี", "holiday", "all", "queen"),
  H("2026-07-28", "วันเฉลิมพระชนมพรรษา ในหลวงรัชกาลที่ 10", "holiday", "all", "king"),
  H("2026-07-29", "วันอาสาฬหบูชา", "holiday", "all", "buddhist"),
  H("2026-07-30", "วันเข้าพรรษา", "holiday", "gov", "buddhist", { note: "ธนาคารเปิดทำการตามปกติ" }),
  H("2026-08-12", "วันแม่แห่งชาติ", "holiday", "all", "mother", { note: "วันเฉลิมพระชนมพรรษา พระพันปีหลวง" }),
  H("2026-10-10", "เทศกาลกินเจ", "festival", null, "vegetarian", { end: "2026-10-18" }),
  H("2026-10-13", "วันคล้ายวันสวรรคต ในหลวงรัชกาลที่ 9", "holiday", "all", "memorial"),
  H("2026-10-23", "วันปิยมหาราช", "holiday", "all", "royal"),
  H("2026-10-26", "วันออกพรรษา", "observance", null, "buddhist"),
  H("2026-10-31", "วันฮาโลวีน", "festival", null, "halloween"),
  H("2026-11-24", "วันลอยกระทง", "festival", null, "loykrathong", { note: "ขึ้น 15 ค่ำ เดือน 12 · ไม่ใช่วันหยุดราชการ" }),
  H("2026-12-05", "วันพ่อแห่งชาติ · วันชาติ", "holiday", "all", "father", { note: "วันคล้ายวันพระบรมราชสมภพ ในหลวงรัชกาลที่ 9" }),
  H("2026-12-07", "ชดเชยวันพ่อแห่งชาติ", "holiday", "all", "father"),
  H("2026-12-10", "วันรัฐธรรมนูญ", "holiday", "all", "constitution"),
  H("2026-12-25", "วันคริสต์มาส", "festival", null, "christmas"),
  H("2026-12-31", "วันสิ้นปี", "holiday", "all", "newyear"),
  // ---------------------------------------------------------------- 2570 (2027)
  H("2027-01-01", "วันขึ้นปีใหม่", "holiday", "all", "newyear"),
  H("2027-01-09", "วันเด็กแห่งชาติ", "observance", null, "children", { note: "วันเสาร์ที่สองของเดือนมกราคม" }),
  H("2027-01-16", "วันครู", "observance", null, "teacher"),
  H("2027-02-06", "วันตรุษจีน", "festival", null, "cny"),
  H("2027-02-14", "วันวาเลนไทน์", "festival", null, "valentine"),
  H("2027-02-21", "วันมาฆบูชา", "holiday", "all", "buddhist"),
  H("2027-02-22", "ชดเชยวันมาฆบูชา", "holiday", "all", "buddhist"),
  H("2027-04-06", "วันจักรี", "holiday", "all", "royal"),
  H("2027-04-13", "เทศกาลสงกรานต์", "holiday", "all", "songkran", { end: "2027-04-15" }),
  H("2027-05-01", "วันแรงงานแห่งชาติ", "holiday", "bank", "labour"),
  H("2027-05-03", "ชดเชยวันแรงงานแห่งชาติ", "holiday", "bank", "labour"),
  H("2027-05-04", "วันฉัตรมงคล", "holiday", "all", "royal"),
  H("2027-05-20", "วันวิสาขบูชา", "holiday", "all", "buddhist"),
  H("2027-06-03", "วันเฉลิมพระชนมพรรษา สมเด็จพระราชินี", "holiday", "all", "queen"),
  H("2027-07-18", "วันอาสาฬหบูชา", "holiday", "all", "buddhist"),
  H("2027-07-19", "วันเข้าพรรษา · ชดเชยวันอาสาฬหบูชา", "holiday", "all", "buddhist", { note: "ราชการหยุดวันเข้าพรรษา ธนาคารหยุดชดเชยวันอาสาฬหบูชา" }),
  H("2027-07-20", "ชดเชยวันอาสาฬหบูชา (ราชการ)", "holiday", "gov", "buddhist", { pending: true, note: "รอมติคณะรัฐมนตรี" }),
  H("2027-07-28", "วันเฉลิมพระชนมพรรษา ในหลวงรัชกาลที่ 10", "holiday", "all", "king"),
  H("2027-08-12", "วันแม่แห่งชาติ", "holiday", "all", "mother", { note: "วันเฉลิมพระชนมพรรษา พระพันปีหลวง" }),
  H("2027-09-30", "เทศกาลกินเจ", "festival", null, "vegetarian", { end: "2027-10-08" }),
  H("2027-10-13", "วันคล้ายวันสวรรคต ในหลวงรัชกาลที่ 9", "holiday", "all", "memorial"),
  H("2027-10-15", "วันออกพรรษา", "observance", null, "buddhist"),
  H("2027-10-23", "วันปิยมหาราช", "holiday", "all", "royal"),
  H("2027-10-25", "ชดเชยวันปิยมหาราช", "holiday", "all", "royal"),
  H("2027-10-31", "วันฮาโลวีน", "festival", null, "halloween"),
  H("2027-11-13", "วันลอยกระทง", "festival", null, "loykrathong", { note: "ไม่ใช่วันหยุดราชการ" }),
  H("2027-12-05", "วันพ่อแห่งชาติ · วันชาติ", "holiday", "all", "father", { note: "วันคล้ายวันพระบรมราชสมภพ ในหลวงรัชกาลที่ 9" }),
  H("2027-12-06", "ชดเชยวันพ่อแห่งชาติ", "holiday", "all", "father"),
  H("2027-12-10", "วันรัฐธรรมนูญ", "holiday", "all", "constitution"),
  H("2027-12-25", "วันคริสต์มาส", "festival", null, "christmas"),
  H("2027-12-31", "วันสิ้นปี", "holiday", "all", "newyear"),
];

export const TYPE_TH: Record<HolidayType, string> = { holiday: "วันหยุด", festival: "เทศกาล", observance: "วันสำคัญ" };
export const OFF_TH: Record<Exclude<DayOff, null>, string> = {
  all: "หยุดราชการและธนาคาร",
  gov: "หยุดเฉพาะราชการ (ธนาคารเปิด)",
  bank: "หยุดธนาคารและเอกชนส่วนใหญ่ (ราชการเปิด)",
};

export const endOf = (h: Holiday) => h.end ?? h.date;

/** Holidays overlapping [from, to] (inclusive), in date order. */
export function holidaysIn(from: string, to: string, list: Holiday[] = HOLIDAYS): Holiday[] {
  return list.filter((h) => h.date <= to && endOf(h) >= from).sort((a, b) => a.date.localeCompare(b.date));
}

/** Holidays on one day: days off first, then festivals, then observances. */
export function holidaysOn(list: Holiday[], day: string): Holiday[] {
  const rank: Record<HolidayType, number> = { holiday: 0, festival: 1, observance: 2 };
  return list.filter((h) => h.date <= day && endOf(h) >= day).sort((a, b) => rank[a.type] - rank[b.type]);
}

/** A day counts as a day off when any holiday on it closes government or banks (pending ones excluded). */
export const isDayOff = (hs: Holiday[]) => hs.some((h) => h.off && !h.pending);

/** CE years in [from, to] that have no checked holiday data. */
export function missingYears(from: string, to: string): number[] {
  const out: number[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) if (!(HOLIDAY_YEARS as readonly number[]).includes(y)) out.push(y);
  return out;
}

/** Stable key for links: `<date>:<index of the holiday on that date>`. */
export const holidayKey = (h: Holiday) => `${h.date}:${HOLIDAYS.filter((x) => x.date === h.date).indexOf(h)}`;
export function findHoliday(key: string): Holiday | null {
  const m = /^(\d{4}-\d{2}-\d{2}):(\d)$/.exec(key);
  if (!m) return null;
  return HOLIDAYS.filter((x) => x.date === m[1])[Number(m[2])] ?? null;
}
