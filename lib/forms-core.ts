/** Form Builder — pure helpers (no I/O). Shared by the editor (client), public form (client), server actions and unit tests.
 *  A form is a list of sections, each a list of fields. Every field has a stable internal `key` (Field ID) that never
 *  changes when the label, type or order changes; answers and Field Mapping always use that key. */

export const FIELD_TYPES = [
  "short_text", "long_text", "number", "phone", "email", "url",
  "single_choice", "multiple_choice", "dropdown", "date", "time", "checkbox", "file", "image", "consent",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  short_text: "ข้อความสั้น", long_text: "ข้อความยาว", number: "ตัวเลข", phone: "เบอร์โทรศัพท์", email: "อีเมล", url: "ลิงก์ (URL)",
  single_choice: "เลือกได้ 1 ข้อ", multiple_choice: "เลือกได้หลายข้อ", dropdown: "รายการแบบเลื่อน", date: "วันที่", time: "เวลา",
  checkbox: "ช่องติ๊ก", file: "อัปโหลดไฟล์", image: "อัปโหลดรูปภาพ", consent: "ยินยอม / รับทราบ",
};

export const CHOICE_TYPES: FieldType[] = ["single_choice", "multiple_choice", "dropdown"];
export const FILE_TYPES: FieldType[] = ["file", "image"];
export const isChoice = (t: FieldType) => CHOICE_TYPES.includes(t);
export const isFileType = (t: FieldType) => FILE_TYPES.includes(t);

export type Option = { value: string; label: string };
export type CondOp = "equals" | "not_equals" | "includes" | "not_includes" | "not_empty" | "empty";
export type Condition = { field: string; op: CondOp; value?: string };
export type Validation = {
  minLength?: number; maxLength?: number; min?: number; max?: number; integer?: boolean;
  urlHosts?: string[]; minSelect?: number; maxSelect?: number; notPast?: boolean;
  maxFiles?: number; maxSizeMb?: number; accept?: ("image" | "pdf")[];
};
export type Field = {
  key: string; type: FieldType; label: string; description?: string; placeholder?: string; required: boolean;
  options?: Option[]; validation?: Validation; mapsTo?: string | null; showIf?: Condition[];
  /** STEP 2: prefill from the applicant record through mapsTo; `locked` = shown but not editable. */
  prefill?: boolean; locked?: boolean;
};
export type Section = { key: string; title: string; description?: string; fields: Field[]; showIf?: Condition[]; showTerms?: boolean };
export type FormSettings = {
  intro: string; startLabel: string; submitLabel: string; successTitle: string; successMessage: string; privacyNotice: string;
  heroFileId: string | null; linkUrl?: string | null; linkLabel?: string | null;
};
export type FormSchema = { sections: Section[]; settings: FormSettings };
export type Purpose = "kol_application" | "kol_registration" | "general";
export const PURPOSE_LABEL: Record<Purpose, string> = { kol_application: "ใบสมัคร KOL", kol_registration: "ลงทะเบียน KOL ที่ผ่านคัดเลือก", general: "ฟอร์มทั่วไป" };

export const LIMITS = { sections: 20, fields: 80, options: 40, label: 300, description: 1000, placeholder: 120, textMax: 4000 } as const;

// ---------------------------------------------------------------- keys
const ALPHA = "abcdefghijklmnopqrstuvwxyz0123456789";
export function newKey(prefix: "f" | "s" | "o"): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => ALPHA[b % 36]).join("")}`;
}
export const KEY_RE = /^[a-z][a-z0-9_]{2,40}$/;

// ---------------------------------------------------------------- Field Mapping catalogue (RCM §6.6)
export type MappingDef = { key: string; label: string; group: string; types: FieldType[]; multi?: boolean };
export const SOCIAL_PRESETS: { key: string; label: string; hosts: string[] }[] = [
  { key: "instagram", label: "Instagram", hosts: ["instagram.com"] },
  { key: "tiktok", label: "TikTok", hosts: ["tiktok.com"] },
  { key: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"] },
  { key: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  { key: "line", label: "LINE", hosts: [] },
  { key: "x", label: "X (Twitter)", hosts: ["x.com", "twitter.com"] },
  { key: "lemon8", label: "Lemon8", hosts: ["lemon8-app.com"] },
  { key: "threads", label: "Threads", hosts: ["threads.net", "threads.com"] },
  { key: "other", label: "ช่องทางอื่น", hosts: [] },
];
export const PLATFORM_RE = /^[a-z0-9_]{2,24}$/;
export function platformLabel(p: string): string {
  return SOCIAL_PRESETS.find((s) => s.key === p)?.label ?? p.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const TEXTISH: FieldType[] = ["short_text", "long_text"];
export const MAPPINGS: MappingDef[] = [
  { key: "applicant.full_name", label: "ชื่อผู้สมัคร (ชื่อ–นามสกุล)", group: "ผู้สมัคร", types: ["short_text"] },
  { key: "applicant.creator_name", label: "Creator Name / ชื่อเล่น", group: "ผู้สมัคร", types: ["short_text"] },
  { key: "applicant.phone", label: "เบอร์โทรศัพท์", group: "ผู้สมัคร", types: ["phone", "short_text"] },
  { key: "applicant.line_id", label: "LINE ID", group: "ผู้สมัคร", types: ["short_text"] },
  { key: "applicant.email", label: "อีเมล", group: "ผู้สมัคร", types: ["email"] },
  { key: "applicant.photo", label: "รูปโปรไฟล์", group: "ผู้สมัคร", types: ["image"] },
  { key: "applicant.channels", label: "ช่องทางที่ต้องการร่วมแคมเปญ", group: "ผู้สมัคร", types: ["multiple_choice", "single_choice", "dropdown"] },
  { key: "content.categories", label: "ประเภทคอนเทนต์", group: "Content", types: ["multiple_choice", "single_choice", "dropdown", "short_text"] },
  { key: "content.samples", label: "ตัวอย่างผลงาน", group: "Content", types: ["image", "file", "url", "long_text"], multi: true },
  { key: "content.review_links", label: "ลิงก์คลิปรีวิว", group: "Content", types: ["url", "long_text"], multi: true },
  { key: "content.post_links", label: "ลิงก์โพสต์ที่ต้องการนำเสนอ", group: "Content", types: ["url", "long_text"], multi: true },
  { key: "tennis.experience", label: "ประสบการณ์เล่นเทนนิส", group: "Content", types: ["single_choice", "dropdown", ...TEXTISH] },
  { key: "applicant.bio", label: "แนะนำตัว", group: "Content", types: TEXTISH },
  { key: "applicant.motivation", label: "เหตุผลที่สนใจร่วมงาน", group: "Content", types: TEXTISH },
  { key: "terms.accept", label: "รับทราบเงื่อนไขแคมเปญ", group: "เงื่อนไข", types: ["consent", "checkbox", "single_choice"] },
  { key: "reg.visit_date", label: "วันเข้าใช้บริการ (Visit Date)", group: "นัดหมาย", types: ["date"] },
  { key: "reg.visit_time", label: "เวลาเข้าใช้บริการ", group: "นัดหมาย", types: ["time"] },
  { key: "reg.coach", label: "ต้องการโค้ช (Coach Requirement)", group: "นัดหมาย", types: ["single_choice", "dropdown", "checkbox"] },
  { key: "reg.notes", label: "หมายเหตุจาก KOL", group: "นัดหมาย", types: TEXTISH },
  { key: "reg.membership_name", label: "ชื่อ Membership", group: "นัดหมาย", types: ["short_text"] },
  { key: "reg.ack", label: "การรับทราบ / ยืนยัน", group: "เงื่อนไข", types: ["consent", "checkbox", "single_choice"], multi: true },
];
export const SOCIAL_MAP_RE = /^social\.([a-z0-9_]{2,24})\.(url|followers)$/;
export function mappingLabel(key: string | null | undefined): string {
  if (!key) return "ไม่ผูกข้อมูล";
  const m = SOCIAL_MAP_RE.exec(key);
  if (m) return `${platformLabel(m[1])} · ${m[2] === "url" ? "ลิงก์โปรไฟล์" : "จำนวน Followers"}`;
  return MAPPINGS.find((d) => d.key === key)?.label ?? key;
}
export function mappingAllows(key: string, type: FieldType): boolean {
  const m = SOCIAL_MAP_RE.exec(key);
  if (m) return m[2] === "url" ? type === "url" : type === "number";
  const def = MAPPINGS.find((d) => d.key === key);
  return !!def && def.types.includes(type);
}
const isMultiMapping = (key: string) => !!MAPPINGS.find((d) => d.key === key)?.multi;

/** Mappings the workflow depends on — publishing is blocked until each is assigned to a field. */
export const REQUIRED_MAPPINGS: Record<Purpose, string[]> = {
  kol_application: ["applicant.full_name", "applicant.phone", "terms.accept"],
  kol_registration: ["applicant.full_name", "applicant.phone", "reg.visit_date"],
  general: [],
};

// ---------------------------------------------------------------- schema validation (editor → server)
const trimTo = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim().slice(0, max) : "");
const optText = (v: unknown, max: number) => { const s = trimTo(v, max); return s || undefined; };
const intIn = (v: unknown, lo: number, hi: number): number | undefined => {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : undefined;
};
const OPS: CondOp[] = ["equals", "not_equals", "includes", "not_includes", "not_empty", "empty"];

export type SchemaIssue = { path: string; message: string };

/** Normalises untrusted editor JSON into a FormSchema (drops unknown keys, clamps sizes). Throws on structural errors. */
export function normalizeSchema(raw: unknown): FormSchema {
  if (!raw || typeof raw !== "object") throw new Error("รูปแบบฟอร์มไม่ถูกต้อง");
  const r = raw as Record<string, unknown>;
  const rawSections = Array.isArray(r.sections) ? r.sections.slice(0, LIMITS.sections) : [];
  const seenKeys = new Set<string>();
  let fieldCount = 0;
  const sections: Section[] = rawSections.map((s, si) => {
    const so = (s ?? {}) as Record<string, unknown>;
    const key = typeof so.key === "string" && KEY_RE.test(so.key) ? so.key : `s_auto${si}`;
    const fields: Field[] = (Array.isArray(so.fields) ? so.fields : []).flatMap((f) => {
      if (fieldCount >= LIMITS.fields) return [];
      const fo = (f ?? {}) as Record<string, unknown>;
      const type = FIELD_TYPES.includes(fo.type as FieldType) ? (fo.type as FieldType) : null;
      const fkey = typeof fo.key === "string" && KEY_RE.test(fo.key) ? fo.key : null;
      if (!type || !fkey) throw new Error("พบคำถามที่ไม่มีรหัสหรือชนิดที่ถูกต้อง");
      if (seenKeys.has(fkey)) throw new Error("รหัสคำถามซ้ำกัน");
      seenKeys.add(fkey);
      fieldCount++;
      const out: Field = { key: fkey, type, label: trimTo(fo.label, LIMITS.label), required: fo.required === true };
      const desc = optText(fo.description, LIMITS.description); if (desc) out.description = desc;
      const ph = optText(fo.placeholder, LIMITS.placeholder); if (ph) out.placeholder = ph;
      if (isChoice(type)) {
        const seen = new Set<string>();
        out.options = (Array.isArray(fo.options) ? fo.options : []).slice(0, LIMITS.options).flatMap((o) => {
          const oo = (o ?? {}) as Record<string, unknown>;
          const value = typeof oo.value === "string" && /^[a-z0-9_]{1,40}$/.test(oo.value) ? oo.value : null;
          const label = trimTo(oo.label, 200);
          if (!value || !label || seen.has(value)) return [];
          seen.add(value);
          return [{ value, label }];
        });
      }
      const v = (fo.validation ?? {}) as Record<string, unknown>;
      const val: Validation = {};
      const setN = (k: keyof Validation, lo: number, hi: number) => { const n = intIn(v[k], lo, hi); if (n !== undefined) (val as Record<string, unknown>)[k] = n; };
      if (type === "short_text" || type === "long_text") { setN("minLength", 0, LIMITS.textMax); setN("maxLength", 1, LIMITS.textMax); }
      if (type === "number") { setN("min", -1e12, 1e12); setN("max", -1e12, 1e12); if (v.integer === true) val.integer = true; }
      if (type === "url" && Array.isArray(v.urlHosts)) {
        const hosts = v.urlHosts.map((h) => trimTo(h, 80).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter((h) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h));
        if (hosts.length) val.urlHosts = [...new Set(hosts)].slice(0, 8);
      }
      if (type === "multiple_choice") { setN("minSelect", 0, LIMITS.options); setN("maxSelect", 1, LIMITS.options); }
      if (type === "date" && v.notPast === true) val.notPast = true;
      if (isFileType(type)) {
        val.maxFiles = intIn(v.maxFiles, 1, 5) ?? 1;
        val.maxSizeMb = intIn(v.maxSizeMb, 1, 10) ?? 5;
        if (type === "file") {
          const acc = (Array.isArray(v.accept) ? v.accept : ["image", "pdf"]).filter((a): a is "image" | "pdf" => a === "image" || a === "pdf");
          val.accept = acc.length ? [...new Set(acc)] : ["image", "pdf"];
        }
      }
      if (Object.keys(val).length) out.validation = val;
      if (typeof fo.mapsTo === "string" && fo.mapsTo) out.mapsTo = fo.mapsTo.slice(0, 60);
      const conds = normalizeConditions(fo.showIf);
      if (conds.length) out.showIf = conds;
      if (fo.prefill === true) out.prefill = true;
      if (fo.locked === true) out.locked = true;
      return [out];
    });
    const sec: Section = { key, title: trimTo(so.title, LIMITS.label), fields };
    const sdesc = optText(so.description, LIMITS.description); if (sdesc) sec.description = sdesc;
    const sconds = normalizeConditions(so.showIf); if (sconds.length) sec.showIf = sconds;
    if (so.showTerms === true) sec.showTerms = true;
    return sec;
  });
  const st = (r.settings ?? {}) as Record<string, unknown>;
  const settings: FormSettings = {
    intro: trimTo(st.intro, 2000),
    startLabel: trimTo(st.startLabel, 40) || "เริ่มกรอกใบสมัคร",
    submitLabel: trimTo(st.submitLabel, 40) || "ส่งข้อมูล",
    successTitle: trimTo(st.successTitle, 120) || "ส่งข้อมูลเรียบร้อยแล้ว",
    successMessage: trimTo(st.successMessage, 2000),
    privacyNotice: trimTo(st.privacyNotice, 2000),
    heroFileId: typeof st.heroFileId === "string" && /^[0-9a-f-]{36}$/i.test(st.heroFileId) ? st.heroFileId : null,
    linkUrl: typeof st.linkUrl === "string" && /^https:\/\/\S{3,500}$/.test(st.linkUrl.trim()) ? st.linkUrl.trim() : null,
    linkLabel: optText(st.linkLabel, 80) ?? null,
  };
  return { sections, settings };
}

function normalizeConditions(raw: unknown): Condition[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 5).flatMap((c) => {
    const co = (c ?? {}) as Record<string, unknown>;
    if (typeof co.field !== "string" || !KEY_RE.test(co.field) || !OPS.includes(co.op as CondOp)) return [];
    const out: Condition = { field: co.field, op: co.op as CondOp };
    if (co.op !== "empty" && co.op !== "not_empty") out.value = trimTo(co.value, 200);
    return [out];
  });
}

export const allFields = (s: FormSchema): Field[] => s.sections.flatMap((x) => x.fields);
export const fieldByKey = (s: FormSchema, key: string) => allFields(s).find((f) => f.key === key);

/** Problems that block publishing (labels, options, conditions, mappings the workflow needs). */
export function publishIssues(s: FormSchema, purpose: Purpose): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const order = new Map<string, number>();
  allFields(s).forEach((f, i) => order.set(f.key, i));
  if (!s.sections.length || !allFields(s).length) issues.push({ path: "form", message: "ฟอร์มต้องมีอย่างน้อย 1 คำถาม" });
  const mapped = new Map<string, string[]>();
  s.sections.forEach((sec, si) => {
    if (!sec.title) issues.push({ path: sec.key, message: `ตั้งชื่อส่วนที่ ${si + 1}` });
    const firstIdx = sec.fields.length ? order.get(sec.fields[0].key)! : Infinity;
    for (const c of sec.showIf ?? []) {
      const src = order.get(c.field);
      if (src === undefined || src >= firstIdx) issues.push({ path: sec.key, message: `เงื่อนไขของส่วน “${sec.title || si + 1}” ต้องอ้างถึงคำถามก่อนหน้า` });
    }
    sec.fields.forEach((f) => {
      const name = f.label || "(ไม่มีชื่อ)";
      if (!f.label) issues.push({ path: f.key, message: "มีคำถามที่ยังไม่ได้ตั้งชื่อ" });
      if (isChoice(f.type) && (f.options?.length ?? 0) < 1) issues.push({ path: f.key, message: `“${name}” ต้องมีตัวเลือกอย่างน้อย 1 ข้อ` });
      const v = f.validation ?? {};
      if (v.minLength !== undefined && v.maxLength !== undefined && v.minLength > v.maxLength) issues.push({ path: f.key, message: `“${name}” ความยาวขั้นต่ำมากกว่าสูงสุด` });
      if (v.min !== undefined && v.max !== undefined && v.min > v.max) issues.push({ path: f.key, message: `“${name}” ค่าต่ำสุดมากกว่าสูงสุด` });
      for (const c of f.showIf ?? []) {
        const src = order.get(c.field);
        if (src === undefined || src >= order.get(f.key)!) issues.push({ path: f.key, message: `เงื่อนไขของ “${name}” ต้องอ้างถึงคำถามที่อยู่ก่อนหน้า` });
        const sf = fieldByKey(s, c.field);
        if (sf && isChoice(sf.type) && c.value && (c.op === "equals" || c.op === "not_equals" || c.op === "includes" || c.op === "not_includes")
          && !sf.options?.some((o) => o.value === c.value)) issues.push({ path: f.key, message: `เงื่อนไขของ “${name}” อ้างถึงตัวเลือกที่ถูกลบแล้ว` });
      }
      if (f.mapsTo) {
        if (!mappingAllows(f.mapsTo, f.type)) issues.push({ path: f.key, message: `“${name}” ชนิดคำถามไม่ตรงกับข้อมูลที่ผูก (${mappingLabel(f.mapsTo)})` });
        mapped.set(f.mapsTo, [...(mapped.get(f.mapsTo) ?? []), name]);
      }
    });
  });
  for (const [key, names] of mapped) {
    if (names.length > 1 && !isMultiMapping(key)) issues.push({ path: key, message: `ข้อมูล “${mappingLabel(key)}” ถูกผูกกับหลายคำถาม (${names.join(", ")})` });
  }
  for (const key of REQUIRED_MAPPINGS[purpose]) {
    if (!mapped.has(key)) issues.push({ path: key, message: `ต้องมีคำถามที่ผูกกับ “${mappingLabel(key)}” (ใช้สร้างการ์ด CEO และ Workflow)` });
  }
  if (purpose === "kol_application" && ![...mapped.keys()].some((k) => /^social\..+\.url$/.test(k))) {
    issues.push({ path: "social", message: "ต้องมีคำถามลิงก์ Social Media อย่างน้อย 1 ช่องทาง (ผูกกับ Social · ลิงก์โปรไฟล์)" });
  }
  return issues;
}

/** Keys of workflow-critical fields: deleting or remapping them needs a replacement first (editor warning). */
export function criticalMappings(purpose: Purpose): string[] {
  return REQUIRED_MAPPINGS[purpose];
}

// ---------------------------------------------------------------- conditional logic
export type AnswerValue = string | number | boolean | string[] | FileRef[] | null;
export type FileRef = { id: string; name: string; size: number; mime: string; claim?: string };
export type Answers = Record<string, AnswerValue>;

export function isEmptyValue(v: AnswerValue | undefined): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "boolean") return v === false;
  return false;
}

function condHolds(c: Condition, a: Answers, visible: Set<string>): boolean {
  const v = visible.has(c.field) ? a[c.field] : undefined;
  const arr = Array.isArray(v) ? (v as unknown[]).map(String) : v === undefined || v === null ? [] : [String(v)];
  switch (c.op) {
    case "empty": return isEmptyValue(v);
    case "not_empty": return !isEmptyValue(v);
    case "equals": return arr.length === 1 && arr[0] === (c.value ?? "");
    case "not_equals": return !(arr.length === 1 && arr[0] === (c.value ?? ""));
    case "includes": return arr.includes(c.value ?? "");
    case "not_includes": return !arr.includes(c.value ?? "");
  }
}

/** Field keys that are currently shown, evaluated in form order (conditions only look backwards). */
export function visibleKeys(s: FormSchema, a: Answers): Set<string> {
  const vis = new Set<string>();
  for (const sec of s.sections) {
    if (!(sec.showIf ?? []).every((c) => condHolds(c, a, vis))) continue;
    for (const f of sec.fields) if ((f.showIf ?? []).every((c) => condHolds(c, a, vis))) vis.add(f.key);
  }
  return vis;
}
export function visibleSections(s: FormSchema, a: Answers): Section[] {
  const vis = visibleKeys(s, a);
  return s.sections.filter((sec) => sec.fields.some((f) => vis.has(f.key)) || (sec.fields.length === 0 && sec.showTerms));
}

// ---------------------------------------------------------------- answer validation (client hint + server authority)
const PHONE_RE = /^\+?[0-9][0-9 -]{7,18}[0-9]$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, "")}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return null;
    return u.toString().slice(0, 500);
  } catch { return null; }
}
export function hostMatches(url: string, hosts: string[]): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return hosts.some((x) => h === x || h.endsWith(`.${x}`));
  } catch { return false; }
}
/** "12,500" / "12.5k" / "1.2M" → integer; invalid → NaN. */
export function parseCount(raw: string): number {
  const s = raw.trim().replace(/,/g, "").toLowerCase();
  const m = /^(\d+(?:\.\d+)?)\s*([km])?$/.exec(s);
  if (!m) return NaN;
  const n = Number(m[1]) * (m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1);
  return Math.round(n);
}
export function bangkokTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Validates one field. Returns [cleanValue, errorMessage|null]. */
export function checkField(f: Field, raw: unknown, today = bangkokTodayIso()): [AnswerValue, string | null] {
  const v = f.validation ?? {};
  const req = (msg = "กรุณากรอกข้อมูลช่องนี้"): [AnswerValue, string | null] => [null, f.required ? msg : null];
  switch (f.type) {
    case "short_text": case "long_text": {
      const max = v.maxLength ?? (f.type === "short_text" ? 200 : 2000);
      const s = typeof raw === "string" ? raw.replace(/\r\n/g, "\n").trim() : typeof raw === "number" ? String(raw) : "";
      if (!s) return req();
      if (s.length > max) return [s, `ยาวเกิน ${max.toLocaleString("en-US")} ตัวอักษร (ตอนนี้ ${s.length.toLocaleString("en-US")})`];
      if (v.minLength && s.length < v.minLength) return [s, `ต้องมีอย่างน้อย ${v.minLength} ตัวอักษร`];
      return [s, null];
    }
    case "number": {
      const s = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw : "";
      if (!s.trim()) return req();
      const n = parseCount(s);
      if (!Number.isFinite(n)) return [null, "กรอกเป็นตัวเลข เช่น 12500 หรือ 12.5k"];
      if (v.min !== undefined && n < v.min) return [n, `ต้องไม่น้อยกว่า ${v.min.toLocaleString("en-US")}`];
      if (v.max !== undefined && n > v.max) return [n, `ต้องไม่เกิน ${v.max.toLocaleString("en-US")}`];
      return [n, null];
    }
    case "phone": {
      const s = typeof raw === "string" ? raw.trim() : "";
      if (!s) return req();
      if (!PHONE_RE.test(s) || s.replace(/\D/g, "").length < 9) return [s, "เบอร์โทรไม่ถูกต้อง ตัวอย่าง 081-234-5678"];
      return [s, null];
    }
    case "email": {
      const s = typeof raw === "string" ? raw.trim() : "";
      if (!s) return req();
      if (!EMAIL_RE.test(s)) return [s, "อีเมลไม่ถูกต้อง ตัวอย่าง name@example.com"];
      return [s.toLowerCase(), null];
    }
    case "url": {
      const s = typeof raw === "string" ? raw.trim() : "";
      if (!s) return req();
      const u = normalizeUrl(s);
      if (!u) return [s, "ลิงก์ไม่ถูกต้อง ตัวอย่าง https://www.instagram.com/ชื่อบัญชี"];
      if (v.urlHosts?.length && !hostMatches(u, v.urlHosts)) return [s, `ใช้ลิงก์จาก ${v.urlHosts.join(" หรือ ")}`];
      return [u, null];
    }
    case "single_choice": case "dropdown": {
      const s = typeof raw === "string" ? raw : Array.isArray(raw) && typeof raw[0] === "string" ? raw[0] : "";
      if (!s) return req("กรุณาเลือก 1 ข้อ");
      if (!f.options?.some((o) => o.value === s)) return [null, "ตัวเลือกไม่ถูกต้อง กรุณาเลือกใหม่"];
      return [s, null];
    }
    case "multiple_choice": {
      const arr = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : typeof raw === "string" && raw ? [raw] : [];
      const clean = [...new Set(arr)].filter((x) => f.options?.some((o) => o.value === x));
      if (!clean.length) return req("กรุณาเลือกอย่างน้อย 1 ข้อ");
      if (v.minSelect && clean.length < v.minSelect) return [clean, `เลือกอย่างน้อย ${v.minSelect} ข้อ`];
      if (v.maxSelect && clean.length > v.maxSelect) return [clean, `เลือกได้ไม่เกิน ${v.maxSelect} ข้อ`];
      return [clean, null];
    }
    case "date": {
      const s = typeof raw === "string" ? raw.trim() : "";
      if (!s) return req("กรุณาเลือกวันที่");
      if (!DATE_RE.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) return [null, "วันที่ไม่ถูกต้อง"];
      if (v.notPast && s < today) return [s, "เลือกวันที่ตั้งแต่วันนี้เป็นต้นไป"];
      return [s, null];
    }
    case "time": {
      const s = typeof raw === "string" ? raw.trim().slice(0, 5) : "";
      if (!s) return req("กรุณาเลือกเวลา");
      if (!TIME_RE.test(s)) return [null, "เวลาไม่ถูกต้อง"];
      return [s, null];
    }
    case "checkbox": case "consent": {
      const on = raw === true || raw === "true" || raw === "on";
      if (!on && f.required) return [false, f.type === "consent" ? "กรุณากดยืนยันเพื่อดำเนินการต่อ" : "กรุณาติ๊กช่องนี้"];
      return [on, null];
    }
    case "file": case "image": {
      const arr = Array.isArray(raw) ? raw : [];
      const refs = arr.flatMap((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        return typeof o.id === "string" && UUID_RE.test(o.id)
          ? [{ id: o.id, name: trimTo(o.name, 200) || "ไฟล์", size: Number(o.size) || 0, mime: trimTo(o.mime, 60), ...(typeof o.claim === "string" ? { claim: o.claim.slice(0, 100) } : {}) }]
          : [];
      });
      if (!refs.length) return req(f.type === "image" ? "กรุณาแนบรูปภาพ" : "กรุณาแนบไฟล์");
      if (refs.length > (v.maxFiles ?? 1)) return [refs, `แนบได้ไม่เกิน ${v.maxFiles ?? 1} ไฟล์`];
      return [refs, null];
    }
  }
}

/** Validates all visible fields. Hidden fields are dropped (they are never stored). */
export function validateAnswers(s: FormSchema, raw: Record<string, unknown>, opts: { sectionKey?: string; today?: string } = {}):
  { answers: Answers; errors: Record<string, string> } {
  const answers: Answers = {};
  const errors: Record<string, string> = {};
  // Visibility is decided on cleaned values, in order.
  const vis = new Set<string>();
  for (const sec of s.sections) {
    const secOn = (sec.showIf ?? []).every((c) => condHolds(c, answers, vis));
    for (const f of sec.fields) {
      if (!secOn || !(f.showIf ?? []).every((c) => condHolds(c, answers, vis))) continue;
      vis.add(f.key);
      const [val, err] = checkField(f, raw[f.key], opts.today);
      if (val !== null) answers[f.key] = val;
      if (err && (!opts.sectionKey || opts.sectionKey === sec.key)) errors[f.key] = err;
    }
  }
  return { answers, errors };
}

// ---------------------------------------------------------------- mapping extraction (answers → applicant record)
export type Mapped = {
  fullName?: string; creatorName?: string; phone?: string; lineId?: string; email?: string;
  photo?: FileRef; channels: string[]; categories: string[]; sampleLinks: string[]; sampleFiles: FileRef[];
  tennis?: string; bio?: string; motivation?: string; termsAccepted: boolean;
  social: Record<string, { url?: string; followers?: number }>;
  visitDate?: string; visitTime?: string; coach?: boolean | null; notes?: string; membershipName?: string; acks: string[];
};
const optLabel = (f: Field, v: string) => f.options?.find((o) => o.value === v)?.label ?? v;
const splitLinks = (s: string) => s.split(/[\s,]+/).map(normalizeUrl).filter((x): x is string => !!x);

export function extractMapped(s: FormSchema, a: Answers): Mapped {
  const m: Mapped = { channels: [], categories: [], sampleLinks: [], sampleFiles: [], termsAccepted: false, social: {}, acks: [] };
  for (const f of allFields(s)) {
    const v = a[f.key];
    if (!f.mapsTo || v === undefined || v === null) continue;
    const sm = SOCIAL_MAP_RE.exec(f.mapsTo);
    if (sm) {
      const cur = (m.social[sm[1]] ??= {});
      if (sm[2] === "url" && typeof v === "string") cur.url = v;
      if (sm[2] === "followers" && typeof v === "number") cur.followers = v;
      continue;
    }
    const text = typeof v === "string" ? v : undefined;
    const labels = Array.isArray(v) && typeof v[0] === "string" ? (v as string[]).map((x) => optLabel(f, x)) : text && isChoice(f.type) ? [optLabel(f, text)] : null;
    switch (f.mapsTo) {
      case "applicant.full_name": m.fullName = text; break;
      case "applicant.creator_name": m.creatorName = text; break;
      case "applicant.phone": m.phone = text; break;
      case "applicant.line_id": m.lineId = text; break;
      case "applicant.email": m.email = text; break;
      case "applicant.photo": if (Array.isArray(v) && v[0] && typeof v[0] === "object") m.photo = v[0] as FileRef; break;
      case "applicant.channels": {
        // Channel options keep their value (instagram / tiktok / other …) so they line up with social.<platform>.
        m.channels = Array.isArray(v) ? (v as string[]) : text ? [text] : [];
        break;
      }
      case "content.categories": m.categories = labels ?? (text ? text.split(/[,\n]/).map((x) => x.trim()).filter(Boolean) : []); break;
      case "content.samples": case "content.review_links": case "content.post_links":
        if (text) m.sampleLinks.push(...splitLinks(text));
        else if (Array.isArray(v) && v[0] && typeof v[0] === "object") m.sampleFiles.push(...(v as FileRef[]));
        break;
      case "tennis.experience": m.tennis = labels?.[0] ?? text; break;
      case "applicant.bio": m.bio = text; break;
      case "applicant.motivation": m.motivation = text; break;
      case "terms.accept": m.termsAccepted = v === true || (typeof v === "string" && v !== ""); break;
      case "reg.visit_date": m.visitDate = text; break;
      case "reg.visit_time": m.visitTime = text; break;
      case "reg.coach":
        if (typeof v === "boolean") m.coach = v;
        else if (text) m.coach = text === "yes" ? true : text === "no" ? false : !/ไม่/.test(optLabel(f, text));
        break;
      case "reg.notes": m.notes = text; break;
      case "reg.membership_name": m.membershipName = text; break;
      case "reg.ack": if (v === true || text) m.acks.push(f.label); break;
    }
  }
  return m;
}

/** Applicant data → answers for STEP 2 prefill (only fields marked prefill). */
export type PrefillSource = {
  fullName: string; creatorName: string; phone: string | null; lineId: string | null; email: string | null;
  social: Record<string, { url: string | null; followers: number | null }>;
};
export function prefillAnswers(s: FormSchema, src: PrefillSource): Answers {
  const out: Answers = {};
  for (const f of allFields(s)) {
    if (!f.prefill || !f.mapsTo) continue;
    const sm = SOCIAL_MAP_RE.exec(f.mapsTo);
    if (sm) {
      const acc = src.social[sm[1]];
      if (sm[2] === "url" && acc?.url) out[f.key] = acc.url;
      if (sm[2] === "followers" && acc?.followers !== null && acc?.followers !== undefined) out[f.key] = acc.followers;
      continue;
    }
    const val = { "applicant.full_name": src.fullName, "applicant.creator_name": src.creatorName, "applicant.phone": src.phone,
      "applicant.line_id": src.lineId, "applicant.email": src.email }[f.mapsTo];
    if (val) out[f.key] = val;
  }
  return out;
}

// ---------------------------------------------------------------- display / export
export function displayAnswer(f: Pick<Field, "type" | "options"> | undefined, v: AnswerValue | undefined): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return v ? "ใช่" : "ไม่";
  if (typeof v === "number") return v.toLocaleString("en-US");
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === "object") return (v as FileRef[]).map((x) => x.name).join(", ");
    return (v as string[]).map((x) => (f?.options ? optLabelSafe(f.options, x) : x)).join(", ");
  }
  if (f?.options && (f.type === "single_choice" || f.type === "dropdown")) return optLabelSafe(f.options, v);
  return v;
}
const optLabelSafe = (opts: Option[], v: string) => opts.find((o) => o.value === v)?.label ?? v;

/** CSV cell: quotes, doubled quotes, and a leading apostrophe against formula injection in spreadsheets. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Breaking change detection for the editor warning: type changed on a field that already has published answers. */
export function typeChangeRisk(from: FieldType, to: FieldType): "none" | "compatible" | "lossy" {
  if (from === to) return "none";
  const groups: FieldType[][] = [["short_text", "long_text", "phone", "email", "url"], ["single_choice", "dropdown"], ["checkbox", "consent"], ["file", "image"]];
  return groups.some((g) => g.includes(from) && g.includes(to)) ? "compatible" : "lossy";
}

export function emptyField(type: FieldType): Field {
  const f: Field = { key: newKey("f"), type, label: "", required: false };
  if (isChoice(type)) f.options = [{ value: newKey("o"), label: "ตัวเลือก 1" }];
  if (isFileType(type)) f.validation = { maxFiles: 1, maxSizeMb: 5, ...(type === "file" ? { accept: ["image", "pdf"] as ("image" | "pdf")[] } : {}) };
  return f;
}

/** Deep copy with fresh keys for "Duplicate" (conditions inside the copy are remapped to the copied keys). */
export function duplicateField(f: Field): Field {
  const c: Field = JSON.parse(JSON.stringify(f));
  c.key = newKey("f");
  c.mapsTo = null;
  if (c.options) c.options = c.options.map((o) => ({ ...o }));
  return c;
}
