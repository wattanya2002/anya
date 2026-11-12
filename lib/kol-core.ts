/** KOL recruitment — pure helpers (no I/O): statuses, allowed transitions, labels, counts and message text. */

export const APPLICANT_STATUSES = [
  "submitted", "shortlisted", "info_requested", "pending_ceo", "ceo_info_requested", "approved", "rejected", "registered",
] as const;
export type ApplicantStatus = (typeof APPLICANT_STATUSES)[number];

export const STATUS_LABEL: Record<ApplicantStatus, string> = {
  submitted: "รอตรวจสอบ",
  shortlisted: "ผ่านการคัดกรอง",
  info_requested: "ขอข้อมูลเพิ่มจากผู้สมัคร",
  pending_ceo: "รอ CEO อนุมัติ",
  ceo_info_requested: "CEO ขอข้อมูลเพิ่ม",
  approved: "อนุมัติแล้ว · รอกรอก STEP 2",
  rejected: "ไม่ผ่าน",
  registered: "ยืนยันข้อมูลแล้ว",
};
/** Tone for the status badge (text is always shown too — colour is never the only signal). */
export const STATUS_TONE: Record<ApplicantStatus, "blue" | "green" | "amber" | "red" | "purple" | "navy" | "gray"> = {
  submitted: "blue", shortlisted: "purple", info_requested: "amber", pending_ceo: "navy", ceo_info_requested: "amber",
  approved: "green", rejected: "red", registered: "green",
};
/** What the applicant sees on their own status page (no internal detail). */
export const PUBLIC_STATUS: Record<ApplicantStatus, { title: string; body: string }> = {
  submitted: { title: "ได้รับใบสมัครแล้ว", body: "ทีมการตลาดกำลังตรวจสอบข้อมูลของคุณ" },
  shortlisted: { title: "อยู่ระหว่างพิจารณา", body: "ใบสมัครของคุณผ่านการตรวจสอบเบื้องต้นแล้ว" },
  info_requested: { title: "ทีมงานขอข้อมูลเพิ่มเติม", body: "ทีมงานจะติดต่อคุณทาง LINE หรือโทรศัพท์ที่ให้ไว้" },
  pending_ceo: { title: "อยู่ระหว่างพิจารณา", body: "ใบสมัครของคุณอยู่ในขั้นพิจารณาสุดท้าย" },
  ceo_info_requested: { title: "อยู่ระหว่างพิจารณา", body: "ทีมงานอาจติดต่อเพื่อสอบถามข้อมูลเพิ่มเติม" },
  approved: { title: "ยินดีด้วย คุณผ่านการคัดเลือก", body: "ทีมงานจะส่งลิงก์ลงทะเบียนให้ทาง LINE เพื่อนัดวันเข้าใช้บริการ" },
  rejected: { title: "ขอบคุณที่สนใจร่วมงาน", body: "รอบนี้ใบสมัครของคุณยังไม่ได้รับการคัดเลือก" },
  registered: { title: "ลงทะเบียนเรียบร้อย", body: "ทีมงานได้รับข้อมูลนัดหมายของคุณแล้ว" },
};

export type Actor = "marketing" | "ceo" | "applicant";
/** Allowed status changes. Marketing can never set approved / rejected-by-CEO; CEO decides only pending cards. */
export const TRANSITIONS: Record<string, { from: ApplicantStatus[]; to: ApplicantStatus; by: Actor }> = {
  shortlist: { from: ["submitted", "info_requested", "ceo_info_requested"], to: "shortlisted", by: "marketing" },
  request_info: { from: ["submitted", "shortlisted", "ceo_info_requested"], to: "info_requested", by: "marketing" },
  reject_screening: { from: ["submitted", "shortlisted", "info_requested", "ceo_info_requested"], to: "rejected", by: "marketing" },
  send_to_ceo: { from: ["submitted", "shortlisted", "info_requested", "ceo_info_requested"], to: "pending_ceo", by: "marketing" },
  ceo_approve: { from: ["pending_ceo"], to: "approved", by: "ceo" },
  ceo_reject: { from: ["pending_ceo"], to: "rejected", by: "ceo" },
  ceo_request_info: { from: ["pending_ceo"], to: "ceo_info_requested", by: "ceo" },
  register: { from: ["approved", "registered"], to: "registered", by: "applicant" },
};
export type TransitionKey = keyof typeof TRANSITIONS;
export function canTransition(key: TransitionKey, from: ApplicantStatus): boolean {
  return TRANSITIONS[key].from.includes(from);
}

// ---------------------------------------------------------------- dashboard buckets (RCM §7.1)
export const BUCKETS = [
  { key: "all", label: "ผู้สมัครทั้งหมด" },
  { key: "new", label: "ผู้สมัครใหม่" },
  { key: "review", label: "รอตรวจสอบ" },
  { key: "shortlisted", label: "ผ่านการคัดกรอง" },
  { key: "pending_ceo", label: "รอ CEO อนุมัติ" },
  { key: "approved_all", label: "CEO อนุมัติแล้ว" },
  { key: "rejected", label: "ไม่ผ่าน" },
  { key: "awaiting_step2", label: "รอกรอก STEP 2" },
  { key: "registered", label: "ยืนยันข้อมูลแล้ว" },
] as const;
export type BucketKey = (typeof BUCKETS)[number]["key"];
/** Statuses that belong to a bucket ("new" additionally requires that nobody has opened it yet). */
export const BUCKET_STATUSES: Record<BucketKey, ApplicantStatus[]> = {
  all: [...APPLICANT_STATUSES],
  new: ["submitted"],
  review: ["submitted", "info_requested", "ceo_info_requested"],
  shortlisted: ["shortlisted"],
  pending_ceo: ["pending_ceo"],
  approved_all: ["approved", "registered"],
  rejected: ["rejected"],
  awaiting_step2: ["approved"],
  registered: ["registered"],
};
export function parseBucket(v: unknown): BucketKey {
  return typeof v === "string" && BUCKETS.some((b) => b.key === v) ? (v as BucketKey) : "all";
}
export const SORTS = [
  { key: "newest", label: "สมัครล่าสุด" },
  { key: "oldest", label: "สมัครก่อน" },
  { key: "followers", label: "Followers มากสุด" },
  { key: "name", label: "ชื่อ ก–ฮ / A–Z" },
] as const;
export type SortKey = (typeof SORTS)[number]["key"];
export const parseSort = (v: unknown): SortKey => (typeof v === "string" && SORTS.some((s) => s.key === v) ? (v as SortKey) : "newest");

// ---------------------------------------------------------------- CEO inbox
export const CEO_TABS = [
  { key: "pending", label: "รอพิจารณา" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "info_requested", label: "ขอข้อมูลเพิ่ม" },
  { key: "rejected", label: "ไม่อนุมัติ" },
  { key: "all", label: "ทั้งหมด" },
] as const;
export type CeoTab = (typeof CEO_TABS)[number]["key"];
export const parseCeoTab = (v: unknown): CeoTab => (typeof v === "string" && CEO_TABS.some((t) => t.key === v) ? (v as CeoTab) : "pending");
export const DECISION_LABEL: Record<string, string> = { pending: "รอพิจารณา", approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ", info_requested: "ขอข้อมูลเพิ่ม" };

// ---------------------------------------------------------------- campaign tracking
export const DELIVERABLE_STATUSES = ["not_started", "in_progress", "submitted", "verified"] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];
export const DELIVERABLE_LABEL: Record<DeliverableStatus, string> = {
  not_started: "ยังไม่เริ่ม", in_progress: "กำลังทำ", submitted: "ส่งแล้ว · รอตรวจ", verified: "ตรวจแล้ว",
};
export const VISIT_STATUSES = ["not_scheduled", "scheduled", "confirmed", "visited", "no_show", "cancelled"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export const VISIT_LABEL: Record<VisitStatus, string> = {
  not_scheduled: "ยังไม่นัด", scheduled: "KOL เลือกวันแล้ว · รอทีมยืนยัน", confirmed: "ยืนยันนัดแล้ว", visited: "มาใช้บริการแล้ว", no_show: "ไม่มาตามนัด", cancelled: "ยกเลิก",
};
export type DeliverableTemplate = { key: string; label: string };
export const DEFAULT_DELIVERABLES: DeliverableTemplate[] = [
  { key: "ig_reels", label: "IG Reels 1 คลิป" },
  { key: "ig_post", label: "IG Picture Post 1 โพสต์" },
  { key: "tiktok_review", label: "TikTok Review Video 1 คลิป" },
  { key: "google_review", label: "Google Review" },
];

export type CreditRow = { kind: "entitlement" | "usage" | "adjustment"; hours: number; valueSatang: number };
export function creditSummary(rows: CreditRow[]) {
  const ent = rows.filter((r) => r.kind === "entitlement");
  const entitled = ent.reduce((s, r) => s + r.hours, 0) + rows.filter((r) => r.kind === "adjustment").reduce((s, r) => s + r.hours, 0);
  const used = rows.filter((r) => r.kind === "usage").reduce((s, r) => s + r.hours, 0);
  const entitledValue = ent.reduce((s, r) => s + r.valueSatang, 0);
  const round = (n: number) => Math.round(n * 100) / 100;
  return { entitled: round(entitled), used: round(used), remaining: round(entitled - used), entitledValueSatang: entitledValue };
}

export function deliverableProgress(items: { status: DeliverableStatus }[]) {
  const total = items.length;
  const verified = items.filter((d) => d.status === "verified").length;
  const submitted = items.filter((d) => d.status === "submitted" || d.status === "verified").length;
  return { total, verified, submitted, done: total > 0 && verified === total };
}

// ---------------------------------------------------------------- labels & text
export const applicantRef = (n: number) => `KOL-${String(n).padStart(4, "0")}`;
export const submissionRef = (n: number) => `F-${String(n).padStart(5, "0")}`;

export function maxFollowers(social: { followers: number | null }[]): number {
  return social.reduce((m, s) => Math.max(m, s.followers ?? 0), 0);
}
export function meetsFollowerRule(social: { followers: number | null }[], min: number): boolean {
  return min <= 0 || social.some((s) => (s.followers ?? 0) >= min);
}
export function initials(name: string): string {
  const clean = name.replace(/^(คุณ|น้อง)/, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (!parts.length) return "K";
  const first = [...parts[0]][0] ?? "K";
  const second = parts.length > 1 ? [...parts[1]][0] ?? "" : "";
  return /[a-z]/i.test(first) ? (first + second).toUpperCase() : first;
}

/** Suggested promo code from the creator name: letters/digits only, uppercase, + "30". */
export function suggestPromoCode(creatorName: string, discountBps: number): string {
  const base = creatorName.normalize("NFKD").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12) || "KOL";
  return `${base}${Math.round(discountBps / 100)}`.slice(0, 40);
}
export function isPromoCode(s: string): boolean {
  return /^[A-Z0-9_-]{3,40}$/.test(s);
}

const thaiShortDate = (d: Date) => new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" }).format(d);

/** Message the team copies into LINE (the system does not send LINE messages by itself). */
export function registrationMessage(o: { name: string; url: string; expiresAt: Date }): string {
  return [
    `สวัสดีค่ะ คุณ${o.name}`,
    "ยินดีด้วย คุณผ่านการคัดเลือก KOL ของ Wonder Courts แล้ว",
    `กรุณากรอกข้อมูลยืนยันและเลือกวันเข้าใช้บริการที่ลิงก์นี้ (ใช้ได้ถึง ${thaiShortDate(o.expiresAt)})`,
    o.url,
    "สอบถามเพิ่มเติมได้ที่ LINE @wondercourts",
  ].join("\n");
}
export function infoRequestMessage(o: { name: string; ref: string; reason: string }): string {
  return [`สวัสดีค่ะ คุณ${o.name}`, `ทีมงาน Wonder Courts ขอข้อมูลเพิ่มเติมสำหรับใบสมัคร ${o.ref}`, o.reason, "ตอบกลับทาง LINE @wondercourts ได้เลยค่ะ"].join("\n");
}
/** "@handle" from a profile link (instagram.com/aeng_watt, tiktok.com/@aeng_watt, youtube.com/@x). Null when the link has no handle. */
export function socialHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
    const host = u.hostname.toLowerCase().replace(/^(www|m|vt|vm)\./, "");
    const seg = u.pathname.split("/").filter(Boolean);
    if (!seg.length) return null;
    let h = seg[0];
    if (/youtube\.com$/.test(host) && ["c", "user"].includes(h) && seg[1]) h = seg[1];
    if (["profile.php", "channel", "watch", "share", "p", "reel", "video", "story", "stories"].includes(h)) return null;
    h = decodeURIComponent(h).replace(/^@/, "");
    return /^[\p{L}\p{N}._-]{1,60}$/u.test(h) ? `@${h}` : null;
  } catch {
    return null;
  }
}

/** Ready-made reasons on the CEO decision screens (Master RCM screens 12–13). A note can be added or used on its own. */
export const INFO_REASONS = ["ขอรายละเอียดผลงานเพิ่ม", "ขอสถิติผู้ติดตาม", "ขอข้อมูลประสบการณ์กีฬา/เทนนิส"] as const;
export const REJECT_REASONS = ["ผู้ติดตามไม่ตรงกลุ่ม", "ผลงานยังไม่เหมาะ", "ขอพักไว้ก่อน"] as const;
/** What is recorded as the decision reason: the chosen reason, the note, or both. */
export function decisionNote(reason: string, note: string): string {
  const r = reason.trim(), n = note.trim();
  return r && n ? `${r} — ${n}` : r || n;
}

/** A search that is a reference ("KOL-0026", "kol26", "#26", "26") → 26. A name that only contains digits → null. */
export function refFromQuery(q: string): number | null {
  const m = /^\s*(?:kol[-\s]?|#)?0*(\d{1,9})\s*$/i.exec(q);
  return m ? Number(m[1]) : null;
}

/** Message Marketing sends the CEO with the card link (the system does not send it). */
export function ceoCardMessage(o: { ref: string; name: string; pitch: string; url: string }): string {
  return ["มีการ์ด KOL รอ CEO พิจารณา", `${o.ref} · ${o.name}`, o.pitch.trim() || null, `เปิดการ์ด: ${o.url}`].filter(Boolean).join("\n");
}
export function lineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

export function compactNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "–";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}
