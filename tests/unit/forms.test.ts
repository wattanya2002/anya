import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSchema, publishIssues, validateAnswers, visibleKeys, extractMapped, prefillAnswers, checkField, csvCell, displayAnswer,
  parseCount, normalizeUrl, typeChangeRisk, emptyField, duplicateField, mappingAllows, newKey, KEY_RE, type FormSchema, type Field,
} from "../../lib/forms-core.ts";
import { applicationSchema, registrationSchema } from "../../lib/kol-defaults.ts";

const app = () => normalizeSchema(applicationSchema());
const base = {
  f_full_name: "สมใจ ใจดี", f_creator_name: "SomjaiFit", f_phone: "081-234-5678", f_line_id: "somjai",
  f_channels: ["instagram"], f_ig_url: "instagram.com/somjai", f_ig_followers: "12.5k", f_categories: ["fitness", "tennis"],
  f_tennis: "regular", f_terms: true,
};

test("default forms are publishable (labels, options, conditions, required mappings)", () => {
  assert.deepEqual(publishIssues(app(), "kol_application"), []);
  assert.deepEqual(publishIssues(normalizeSchema(registrationSchema()), "kol_registration"), []);
});

test("normalizeSchema keeps stable keys, drops unknown props and rejects duplicates", () => {
  const s = normalizeSchema({ sections: [{ key: "s_a", title: " A ", hack: 1, fields: [{ key: "f_one", type: "short_text", label: "x", required: true, evil: "<script>" }] }], settings: {} });
  assert.equal(s.sections[0].title, "A");
  assert.deepEqual(Object.keys(s.sections[0].fields[0]).sort(), ["key", "label", "required", "type"]);
  assert.equal(s.settings.submitLabel, "ส่งข้อมูล");
  assert.throws(() => normalizeSchema({ sections: [{ key: "s_a", title: "A", fields: [{ key: "f_one", type: "short_text" }, { key: "f_one", type: "number" }] }] }), /ซ้ำ/);
  assert.throws(() => normalizeSchema({ sections: [{ key: "s_a", title: "A", fields: [{ key: "BAD KEY", type: "short_text" }] }] }));
});

test("publish is blocked when a workflow-critical mapping is removed, or a condition points forward", () => {
  const s = app();
  s.sections[0].fields = s.sections[0].fields.filter((f) => f.mapsTo !== "applicant.phone");
  assert.ok(publishIssues(s, "kol_application").some((i) => i.message.includes("เบอร์โทรศัพท์")));
  const t = app();
  t.sections[0].fields[0].showIf = [{ field: "f_terms", op: "not_empty" }];
  assert.ok(publishIssues(t, "kol_application").some((i) => i.message.includes("ก่อนหน้า")));
  const u = app();
  u.sections[0].fields[1].mapsTo = "applicant.full_name"; // two fields → same single mapping
  assert.ok(publishIssues(u, "kol_application").some((i) => i.message.includes("หลายคำถาม")));
});

test("conditional logic: Instagram fields appear only when Instagram is selected; coach notice only for never-played", () => {
  const s = app();
  const v1 = visibleKeys(s, { f_channels: ["tiktok"] });
  assert.ok(v1.has("f_tt_url") && !v1.has("f_ig_url"));
  const v2 = visibleKeys(s, { f_channels: ["instagram", "other"] });
  assert.ok(v2.has("f_ig_url") && v2.has("f_other_url") && !v2.has("f_tt_url"));
  assert.ok(visibleKeys(s, { f_tennis: "never" }).has("f_coach_info"));
  assert.ok(!visibleKeys(s, { f_tennis: "regular" }).has("f_coach_info"));
});

test("validateAnswers: hidden answers are dropped, required visible ones enforced, values cleaned", () => {
  const s = app();
  const r = validateAnswers(s, { ...base, f_tt_url: "https://tiktok.com/@ignored" });
  assert.deepEqual(r.errors, {});
  assert.equal(r.answers.f_ig_url, "https://instagram.com/somjai");
  assert.equal(r.answers.f_ig_followers, 12500);
  assert.equal(r.answers.f_tt_url, undefined); // hidden → not stored
  const bad = validateAnswers(s, { ...base, f_ig_url: "https://example.com/x", f_phone: "12", f_terms: false, f_tennis: "never" });
  assert.match(bad.errors.f_ig_url, /instagram\.com/);
  assert.match(bad.errors.f_phone, /เบอร์โทร/);
  assert.ok(bad.errors.f_terms);
  assert.ok(bad.errors.f_coach_info); // shown because never-played, and required
  const sec = validateAnswers(s, {}, { sectionKey: "s_general" });
  assert.deepEqual(Object.keys(sec.errors).sort(), ["f_creator_name", "f_full_name", "f_line_id", "f_phone"]);
});

test("checkField: types and limits", () => {
  const f = (p: Partial<Field>): Field => ({ key: "f_x", type: "short_text", label: "x", required: true, ...p });
  assert.equal(checkField(f({ validation: { maxLength: 3 } }), "abcd")[1]?.includes("ยาวเกิน"), true);
  assert.deepEqual(checkField(f({ type: "number", validation: { min: 0 } }), "1,200"), [1200, null]);
  assert.match(checkField(f({ type: "number" }), "abc")[1] ?? "", /ตัวเลข/);
  assert.deepEqual(checkField(f({ type: "email" }), "A@B.co"), ["a@b.co", null]);
  assert.match(checkField(f({ type: "date", validation: { notPast: true } }), "2026-11-01", "2026-11-12")[1] ?? "", /ตั้งแต่วันนี้/);
  assert.deepEqual(checkField(f({ type: "time" }), "09:30"), ["09:30", null]);
  assert.match(checkField(f({ type: "single_choice", options: [{ value: "a", label: "A" }] }), "zzz")[1] ?? "", /ไม่ถูกต้อง/);
  assert.deepEqual(checkField(f({ type: "multiple_choice", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }), ["a", "x", "a"]), [["a"], null]);
  assert.match(checkField(f({ type: "image", validation: { maxFiles: 1 } }), [
    { id: "11111111-1111-4111-8111-111111111111" }, { id: "22222222-2222-4222-8222-222222222222" }])[1] ?? "", /ไม่เกิน 1/);
  assert.deepEqual(checkField(f({ required: false }), ""), [null, null]);
});

test("extractMapped turns answers into applicant data through Field Mapping (not labels)", () => {
  const s = app();
  s.sections[0].fields[0].label = "ชื่อจริง (เปลี่ยนชื่อคำถามแล้ว)"; // relabel must not break the CEO card data
  const { answers } = validateAnswers(s, { ...base, f_review_link: "https://tiktok.com/@x/video/1" });
  const m = extractMapped(s, answers);
  assert.equal(m.fullName, "สมใจ ใจดี");
  assert.equal(m.creatorName, "SomjaiFit");
  assert.deepEqual(m.channels, ["instagram"]);
  assert.deepEqual(m.categories, ["Fitness", "Tennis"]);
  assert.deepEqual(m.social.instagram, { url: "https://instagram.com/somjai", followers: 12500 });
  assert.deepEqual(m.sampleLinks, ["https://tiktok.com/@x/video/1"]);
  assert.equal(m.tennis, "เล่นเป็นประจำ");
  assert.equal(m.termsAccepted, true);
});

test("STEP 2 prefill fills only prefill-marked mapped fields from the applicant record", () => {
  const s = normalizeSchema(registrationSchema());
  const a = prefillAnswers(s, { fullName: "สมใจ", creatorName: "SJ", phone: "0812345678", lineId: "sj", email: null,
    social: { instagram: { url: "https://instagram.com/sj", followers: 5000 }, tiktok: { url: null, followers: null } } });
  assert.equal(a.f_full_name, "สมใจ");
  assert.equal(a.f_ig_followers, 5000);
  assert.equal(a.f_tt_url, undefined);
  assert.equal(a.f_visit_date, undefined);
  const reg = validateAnswers(s, { ...a, f_terms: true, f_tt_url: "https://tiktok.com/@sj", f_tt_followers: "100", f_fb_url: "facebook.com/sj", f_fb_followers: "10",
    f_visit_date: "2026-12-01", f_visit_time: "10:00", f_coach: "yes", f_member_status: "yes", f_member_name: "SJ", f_ack_terms: true, f_ack_line: true, f_ack_contact: true },
  { today: "2026-11-12" });
  assert.deepEqual(reg.errors, {});
  const m = extractMapped(s, reg.answers);
  assert.equal(m.coach, true);
  assert.equal(m.visitDate, "2026-12-01");
  assert.equal(m.membershipName, "SJ");
  assert.equal(m.acks.length, 3);
});

test("helpers: csv injection guard, counts, urls, type change risk, keys, display", () => {
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(parseCount("1.2M"), 1_200_000);
  assert.ok(Number.isNaN(parseCount("lots")));
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl("www.tiktok.com/@a"), "https://www.tiktok.com/@a");
  assert.equal(typeChangeRisk("short_text", "long_text"), "compatible");
  assert.equal(typeChangeRisk("number", "short_text"), "lossy");
  assert.match(newKey("f"), KEY_RE);
  const d = duplicateField({ ...emptyField("single_choice"), mapsTo: "tennis.experience" });
  assert.equal(d.mapsTo, null);
  assert.ok(mappingAllows("social.lemon8.url", "url") && !mappingAllows("social.lemon8.url", "number"));
  assert.equal(displayAnswer({ type: "multiple_choice", options: [{ value: "a", label: "Alpha" }] }, ["a", "z"]), "Alpha, z");
});

test("versioning contract: answers keyed by field key survive label edits, reordering and type change", () => {
  const v1: FormSchema = app();
  const { answers } = validateAnswers(v1, base);
  const v2 = app();
  v2.sections[0].fields.reverse();
  v2.sections[0].fields.forEach((f) => { f.label = `${f.label} (v2)`; });
  // the old answer object still resolves against v1 (the version stored on the submission)
  assert.equal(displayAnswer(v1.sections[1].fields.find((f) => f.key === "f_channels"), answers.f_channels), "Instagram");
  assert.equal(extractMapped(v2, answers).fullName, "สมใจ ใจดี");
});
