/** Default KOL campaign terms and the two starting forms.
 *  - Application (STEP 1): questions from Master RCM §5.2 groups A–D.
 *  - Selected KOL Registration (STEP 2): the questions of the team's Google Form "ข้อมูล KOL/Influencers Wonder Courts"
 *    (checked 12 Nov 2026), plus visit time / coach / notes from RCM §9.2. Combined "Link / จำนวนผู้ติดตาม" answers are
 *    split into a URL field and a number field so follower counts can be compared. Marketing can edit all of it in the Form Builder. */
import type { FormSchema } from "./forms-core.ts";
import { DEFAULT_DELIVERABLES } from "./kol-core.ts";

export const DEFAULT_TERMS = {
  title: "KOL Campaign — Wonder Courts",
  // Exactly the current campaign conditions listed in Master RCM §5.2 (group D).
  items: [
    "เครดิตจองคอร์ทฟรี 10 ชั่วโมง มูลค่า 6,000 บาท (ไม่มีเงื่อนไขการใช้งาน)",
    "Promo Code ส่วนลด 30% สำหรับผู้ติดตาม",
    "IG Reels 1 คลิป",
    "IG Picture Post 1 โพสต์",
    "TikTok วิดีโอรีวิว 1 คลิป",
    "Collab หรือ Tag @wonder.courts พร้อม #wondercourts",
    "Google Review",
    "ผู้ติดตามอย่างน้อย 2,000 คนในอย่างน้อย 1 ช่องทาง",
    "กรณีจองโค้ชต้องชำระค่าชั่วโมงโค้ชแยกต่างหาก",
  ],
  deliverables: DEFAULT_DELIVERABLES,
  creditHours: 10,
  creditValueSatang: 600_000,
  promoDiscountBps: 3000,
  // From the team's brief "Brief KOL/Influencer Wonder Courts": 20 uses within 90 days; work due within 14 days of the first visit.
  promoMaxUses: 20,
  promoValidDays: 90,
  minFollowers: 2000,
  deliverWithinDays: 14,
};

export const BRIEF_URL = "https://docs.google.com/document/d/10GSZKkpQ5wc4Z2ShCGgatEb339JZTKt23PUkQL9rTe4/edit?usp=sharing";

const PRIVACY = "ข้อมูลที่กรอกใช้เพื่อพิจารณาและติดต่อเรื่องแคมเปญ KOL ของ Wonder Courts เท่านั้น เปิดดูได้เฉพาะทีมการตลาดและผู้บริหาร ไม่เปิดเผยต่อบุคคลภายนอก ข้อมูลของผู้ที่ไม่ผ่านการคัดเลือกจะถูกลบภายใน 12 เดือน ขอให้ลบข้อมูลได้ทาง LINE @wondercourts";

export function applicationSchema(): FormSchema {
  return {
    settings: {
      intro: "ร่วมเป็น KOL / Influencer กับ Wonder Courts รับเครดิตจองคอร์ทฟรีและ Promo Code สำหรับผู้ติดตาม กรอกใบสมัครไม่เกิน 5 นาที ไม่ต้องสมัครสมาชิก",
      startLabel: "เริ่มกรอกใบสมัคร",
      submitLabel: "ส่งใบสมัคร",
      successTitle: "ส่งใบสมัครเรียบร้อยแล้ว",
      successMessage: "ทีมการตลาดจะตรวจสอบข้อมูลและติดต่อกลับทาง LINE หรือโทรศัพท์ เก็บเลขอ้างอิงและลิงก์ติดตามสถานะไว้ได้เลย",
      privacyNotice: PRIVACY,
      heroFileId: null,
    },
    sections: [
      {
        key: "s_general", title: "ข้อมูลทั่วไป", description: "ใช้สำหรับติดต่อกลับ",
        fields: [
          { key: "f_full_name", type: "short_text", label: "ชื่อ–นามสกุล", required: true, mapsTo: "applicant.full_name", validation: { maxLength: 120 }, placeholder: "เช่น สมใจ ใจดี" },
          { key: "f_creator_name", type: "short_text", label: "ชื่อเล่น / Creator Name", required: true, mapsTo: "applicant.creator_name", validation: { maxLength: 80 }, placeholder: "ชื่อที่ใช้บนโซเชียล" },
          { key: "f_phone", type: "phone", label: "เบอร์โทรศัพท์", required: true, mapsTo: "applicant.phone", placeholder: "081-234-5678" },
          { key: "f_line_id", type: "short_text", label: "LINE ID", required: true, mapsTo: "applicant.line_id", validation: { maxLength: 60 } },
          { key: "f_photo", type: "image", label: "รูปโปรไฟล์ (ถ้ามี)", required: false, mapsTo: "applicant.photo", validation: { maxFiles: 1, maxSizeMb: 5 } },
        ],
      },
      {
        key: "s_social", title: "Social Media", description: "เลือกช่องทางที่ต้องการร่วมแคมเปญ แล้วกรอกลิงก์และจำนวนผู้ติดตาม",
        fields: [
          {
            key: "f_channels", type: "multiple_choice", label: "ช่องทางที่ต้องการร่วมแคมเปญ", required: true, mapsTo: "applicant.channels",
            options: [{ value: "instagram", label: "Instagram" }, { value: "tiktok", label: "TikTok" }, { value: "other", label: "ช่องทางอื่น" }],
          },
          { key: "f_ig_url", type: "url", label: "Instagram Profile URL", required: true, mapsTo: "social.instagram.url", placeholder: "https://www.instagram.com/…",
            validation: { urlHosts: ["instagram.com"] }, showIf: [{ field: "f_channels", op: "includes", value: "instagram" }] },
          { key: "f_ig_followers", type: "number", label: "จำนวน Followers บน Instagram", required: true, mapsTo: "social.instagram.followers", placeholder: "เช่น 12500",
            validation: { min: 0, integer: true }, showIf: [{ field: "f_channels", op: "includes", value: "instagram" }] },
          { key: "f_tt_url", type: "url", label: "TikTok Profile URL", required: true, mapsTo: "social.tiktok.url", placeholder: "https://www.tiktok.com/@…",
            validation: { urlHosts: ["tiktok.com"] }, showIf: [{ field: "f_channels", op: "includes", value: "tiktok" }] },
          { key: "f_tt_followers", type: "number", label: "จำนวน Followers บน TikTok", required: true, mapsTo: "social.tiktok.followers", placeholder: "เช่น 8000",
            validation: { min: 0, integer: true }, showIf: [{ field: "f_channels", op: "includes", value: "tiktok" }] },
          { key: "f_other_url", type: "url", label: "ช่องทางอื่น (ถ้ามี)", required: true, mapsTo: "social.other.url", placeholder: "ลิงก์โปรไฟล์ เช่น Facebook / YouTube",
            showIf: [{ field: "f_channels", op: "includes", value: "other" }] },
          { key: "f_other_followers", type: "number", label: "จำนวน Followers ของช่องทางอื่น (ถ้ามี)", required: false, mapsTo: "social.other.followers",
            validation: { min: 0, integer: true }, showIf: [{ field: "f_channels", op: "includes", value: "other" }] },
        ],
      },
      {
        key: "s_content", title: "Content Profile", description: "ช่วยให้ทีมเห็นแนวคอนเทนต์ของคุณ",
        fields: [
          {
            key: "f_categories", type: "multiple_choice", label: "ประเภทคอนเทนต์", required: true, mapsTo: "content.categories",
            options: [
              { value: "sport", label: "Sport" }, { value: "tennis", label: "Tennis" }, { value: "fitness", label: "Fitness" },
              { value: "lifestyle", label: "Lifestyle" }, { value: "family", label: "Family" },
            ],
          },
          { key: "f_samples", type: "image", label: "ตัวอย่างผลงาน", description: "แนบภาพตัวอย่างผลงานได้สูงสุด 3 รูป", required: false, mapsTo: "content.samples", validation: { maxFiles: 3, maxSizeMb: 5 } },
          { key: "f_review_link", type: "url", label: "ลิงก์คลิปรีวิว", required: false, mapsTo: "content.review_links", placeholder: "https://…" },
          { key: "f_post_link", type: "url", label: "ลิงก์โพสต์ที่ต้องการนำเสนอ", required: false, mapsTo: "content.post_links", placeholder: "https://…" },
          {
            key: "f_tennis", type: "single_choice", label: "ประสบการณ์การเล่นเทนนิส", required: true, mapsTo: "tennis.experience",
            options: [{ value: "never", label: "ไม่เคยเล่นเทนนิส" }, { value: "beginner", label: "เคยเล่นบ้าง" }, { value: "regular", label: "เล่นเป็นประจำ" }],
          },
          { key: "f_coach_info", type: "checkbox", label: "รับทราบ: หากต้องการให้โค้ชสอน มีค่าชั่วโมงโค้ชแยกต่างหาก (ชำระเอง)", required: true,
            description: "Wonder Courts มีบริการโค้ชสำหรับผู้เริ่มเล่น เครดิตคอร์ทฟรีไม่รวมค่าโค้ช", showIf: [{ field: "f_tennis", op: "equals", value: "never" }] },
          { key: "f_bio", type: "long_text", label: "แนะนำตัวสั้น ๆ", required: false, mapsTo: "applicant.bio", validation: { maxLength: 500 } },
          { key: "f_motivation", type: "long_text", label: "เหตุผลที่สนใจร่วมงาน", required: false, mapsTo: "applicant.motivation", validation: { maxLength: 500 } },
        ],
      },
      {
        key: "s_terms", title: "รับทราบเงื่อนไข", description: "สรุปเงื่อนไขแคมเปญปัจจุบัน", showTerms: true,
        fields: [
          { key: "f_terms", type: "consent", label: "ฉันอ่านและรับทราบเงื่อนไขแคมเปญข้างต้นแล้ว", required: true, mapsTo: "terms.accept" },
        ],
      },
    ],
  };
}

export function registrationSchema(): FormSchema {
  const yesOnly = (label: string) => [{ value: "yes", label }];
  return {
    settings: {
      intro: "แบบฟอร์มนี้ สำหรับกรอกข้อมูลของ KOL/Influencers ที่ได้รับการคัดเลือก ให้มาใช้บริการ Wonder Courts ฟรี พร้อมรีวิวตามเงื่อนไขที่ KOL Specialist กำหนด ช่องทางการติดต่อทั้งหมด ให้ใส่เป็นลิงก์เท่านั้น",
      startLabel: "เริ่มกรอกข้อมูล",
      submitLabel: "ยืนยันข้อมูล",
      successTitle: "ยืนยันข้อมูลเรียบร้อยแล้ว",
      successMessage: "ทีมงานจะยืนยันวันเวลาเข้าใช้บริการและส่ง Code การจองให้ทาง LINE @wondercourts",
      privacyNotice: PRIVACY,
      heroFileId: null,
      linkUrl: BRIEF_URL,
      linkLabel: "เงื่อนไขและข้อตกลงการใช้บริการและการรีวิว (Brief)",
    },
    sections: [
      {
        key: "s_terms", title: "เงื่อนไขและข้อตกลง", description: "เงื่อนไขและข้อตกลงการใช้บริการและการรีวิว ก่อนกรอกฟอร์มทั้งหมดให้เข้าใจ", showTerms: true,
        fields: [{ key: "f_terms", type: "consent", label: "รับทราบเงื่อนไข", required: true, mapsTo: "terms.accept" }],
      },
      {
        key: "s_contact", title: "ข้อมูลผู้ติดต่อ", description: "ข้อมูลจากใบสมัครถูกเติมไว้ให้แล้ว ตรวจสอบหรือแก้ไขได้",
        fields: [
          { key: "f_full_name", type: "short_text", label: "ชื่อ-นามสกุล", required: true, mapsTo: "applicant.full_name", prefill: true, validation: { maxLength: 120 } },
          { key: "f_nickname", type: "short_text", label: "ชื่อเล่น", required: false, mapsTo: "applicant.creator_name", prefill: true, validation: { maxLength: 80 } },
          { key: "f_phone", type: "phone", label: "เบอร์โทรศัพท์", required: true, mapsTo: "applicant.phone", prefill: true },
          { key: "f_line_id", type: "short_text", label: "Line ID", required: true, mapsTo: "applicant.line_id", prefill: true, validation: { maxLength: 60 } },
          { key: "f_line_followers", type: "number", label: "จำนวนผู้ติดตาม LINE (ถ้ามี)", required: false, mapsTo: "social.line.followers", prefill: true, validation: { min: 0, integer: true } },
        ],
      },
      {
        key: "s_social", title: "ช่องทาง Social Media ที่ยืนยัน", description: "ใส่เป็นลิงก์เท่านั้น พร้อมจำนวนผู้ติดตาม",
        fields: [
          { key: "f_ig_url", type: "url", label: "Instagram Link", required: true, mapsTo: "social.instagram.url", prefill: true, validation: { urlHosts: ["instagram.com"] } },
          { key: "f_ig_followers", type: "number", label: "Instagram จำนวนผู้ติดตาม", required: true, mapsTo: "social.instagram.followers", prefill: true, validation: { min: 0, integer: true } },
          { key: "f_tt_url", type: "url", label: "Tiktok Link", required: true, mapsTo: "social.tiktok.url", prefill: true, validation: { urlHosts: ["tiktok.com"] } },
          { key: "f_tt_followers", type: "number", label: "Tiktok จำนวนผู้ติดตาม", required: true, mapsTo: "social.tiktok.followers", prefill: true, validation: { min: 0, integer: true } },
          { key: "f_fb_url", type: "url", label: "Facebook Link", required: true, mapsTo: "social.facebook.url", prefill: true, validation: { urlHosts: ["facebook.com", "fb.com", "fb.me"] } },
          { key: "f_fb_followers", type: "number", label: "Facebook จำนวนผู้ติดตาม", required: true, mapsTo: "social.facebook.followers", prefill: true, validation: { min: 0, integer: true } },
          { key: "f_yt_url", type: "url", label: "Youtube (ถ้ามี)", required: false, mapsTo: "social.youtube.url", prefill: true, validation: { urlHosts: ["youtube.com", "youtu.be"] } },
          { key: "f_yt_followers", type: "number", label: "Youtube จำนวนผู้ติดตาม (ถ้ามี)", required: false, mapsTo: "social.youtube.followers", prefill: true, validation: { min: 0, integer: true } },
        ],
      },
      {
        key: "s_files", title: "ไฟล์ประกอบ (ถ้ามี)",
        fields: [
          { key: "f_comp_card", type: "file", label: "แนบคอมการ์ดหรือโปรไฟล์ (ถ้ามี)", description: "อัปโหลดไฟล์ที่รองรับ 1 รายการ ขนาดสูงสุด 10 MB", required: false,
            validation: { maxFiles: 1, maxSizeMb: 10, accept: ["image", "pdf"] } },
          { key: "f_rate_card", type: "file", label: "แนบเรทการ์ด (ถ้ามี)", required: false, validation: { maxFiles: 1, maxSizeMb: 10, accept: ["image", "pdf"] } },
        ],
      },
      {
        key: "s_visit", title: "นัดหมายเข้าใช้บริการ", description: "Court เปิดให้บริการ 24 ชม.",
        fields: [
          { key: "f_visit_date", type: "date", label: "วันที่สะดวกมาถ่ายทำที่ Wonder Courts ครั้งแรก", required: true, mapsTo: "reg.visit_date", validation: { notPast: true } },
          { key: "f_visit_time", type: "time", label: "เวลาที่สะดวก", required: true, mapsTo: "reg.visit_time" },
          {
            key: "f_coach", type: "single_choice", label: "ต้องการใช้โค้ชหรือไม่", description: "กรณีจองโค้ชต้องชำระค่าชั่วโมงโค้ชแยกต่างหาก", required: true, mapsTo: "reg.coach",
            options: [{ value: "no", label: "ไม่ต้องการ" }, { value: "yes", label: "ต้องการ (ชำระค่าโค้ชเอง)" }],
          },
          { key: "f_notes", type: "long_text", label: "หมายเหตุเพิ่มเติม", required: false, mapsTo: "reg.notes", validation: { maxLength: 1000 } },
        ],
      },
      {
        key: "s_member", title: "Membership", description: "สมัคร Membership Courts ได้ที่ booking.wondercourts.com",
        fields: [
          { key: "f_member_status", type: "single_choice", label: "สมัคร Membership ของ Wonder Courts เพื่อมาใช้บริการแล้วหรือยัง", required: true,
            options: yesOnly("สมัครแล้ว") },
          { key: "f_member_name", type: "short_text", label: "สมัคร Membership ของ Wonder Courts ใช้ชื่อว่าอะไร (จะนำชื่อไปทำโค้ดการใช้บริการฟรีและลด 30% สำหรับผู้ติดตาม)",
            required: true, mapsTo: "reg.membership_name", validation: { maxLength: 80 } },
        ],
      },
      {
        key: "s_confirm", title: "ยืนยันการร่วมงาน",
        fields: [
          { key: "f_ack_terms", type: "consent", label: "อ่านรายละเอียดการร่วมงานครบถ้วน และปฏิบัติตามเงื่อนไขการร่วมงานได้ 100%",
            description: "รับทราบและสามารถปฏิบัติตามเงื่อนไขได้", required: true, mapsTo: "reg.ack" },
          { key: "f_ack_line", type: "consent", label: "รบกวน KOL/Influencers Add Line Official Accounts ที่ @wondercourts พร้อมทักแชท เพื่อรับรหัสเข้าประตูการใช้บริการและรับชมวิธีการเล่น",
            description: "ดำเนินการเรียบร้อย", required: true, mapsTo: "reg.ack" },
          { key: "f_ack_contact", type: "consent", label: "สอบถามข้อมูลได้ที่ อัญญา โทร 095-878-5743 หรือ @wondercourts",
            description: "รับทราบ หากสงสัยหรืออยากสอบถาม จะติดต่อกลับทันที", required: true, mapsTo: "reg.ack" },
        ],
      },
    ],
  };
}
