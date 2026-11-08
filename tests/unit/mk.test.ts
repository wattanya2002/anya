import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateRequestInput, promoBars, monthCells, thaiRange, dueLabel, parseBahtToSatang, parseRange, refLabel, compactCount, weekEndSunFirst,
  initialsOf, relTime, bkkParts,
} from "../../lib/mk-core.ts";

const base = { kind: "ad", title: "ยิงแอด TikTok", summary: "งบ 2 สัปดาห์", decide_by: "2026-11-18" };

test("validate: minimal ad request passes with sensible defaults", () => {
  const r = validateRequestInput({ ...base, amount: "6,000" });
  assert.ok("value" in r);
  assert.equal(r.value.amountSatang, 600_000);
  assert.equal(r.value.allDay, true);
  assert.equal(r.value.repeat, "none");
  assert.equal(r.value.calendarList, "marketing");
  assert.deepEqual(r.value.people, []);
});

test("validate: required fields name the field to focus", () => {
  assert.deepEqual(validateRequestInput({ ...base, title: " " }), { error: "กรอกชื่อคำขอ", field: "title" });
  assert.equal((validateRequestInput({ ...base, summary: "" }) as { field: string }).field, "summary");
  assert.equal((validateRequestInput({ ...base, decide_by: "" }) as { field: string }).field, "decide_by");
  assert.equal((validateRequestInput({ ...base, kind: "x" }) as { field: string }).field, "kind");
  assert.equal((validateRequestInput({ ...base, amount: "6k" }) as { field: string }).field, "amount");
});

test("validate: dates and times are consistent", () => {
  assert.equal((validateRequestInput({ ...base, starts_on: "2026-11-20", ends_on: "2026-11-19" }) as { field: string }).field, "ends_on");
  assert.equal((validateRequestInput({ ...base, starts_on: "2026-11-20" }) as { field: string }).field, "start_time"); // not all-day, no time
  assert.equal((validateRequestInput({ ...base, starts_on: "2026-11-20", start_time: "18:00", end_time: "10:00" }) as { field: string }).field, "end_time");
  const ok = validateRequestInput({ ...base, starts_on: "2026-11-20", ends_on: "2026-12-01", start_time: "10:00", end_time: "18:00" });
  assert.ok("value" in ok);
  assert.equal(ok.value.allDay, false);
  assert.equal(ok.value.startTime, "10:00");
  const allDay = validateRequestInput({ ...base, starts_on: "2026-11-20", all_day: "on", start_time: "10:00" });
  assert.ok("value" in allDay);
  assert.equal(allDay.value.startTime, null); // all-day drops the time
});

test("validate: reminder needs a date only when switched on", () => {
  assert.equal((validateRequestInput({ ...base, remind: "on" }) as { field: string }).field, "remind_on");
  const off = validateRequestInput({ ...base, remind_on: "2026-11-17" });
  assert.ok("value" in off);
  assert.equal(off.value.remindOn, null);
  const on = validateRequestInput({ ...base, remind: "on", remind_on: "2026-11-17", remind_time: "09:00" });
  assert.ok("value" in on);
  assert.equal(on.value.remindTime, "09:00");
});

test("validate: attachments must be https; tags are normalised and capped", () => {
  assert.equal((validateRequestInput({ ...base, "att_url.0": "http://x.test/a.png" }) as { field: string }).field, "att_url.0");
  const r = validateRequestInput({ ...base, "att_url.0": "https://x.test/a.png", "att_kind.0": "image", "att_url.2": "https://x.test/plan.pdf", tags: "แอด, #แอด,คลาสผู้ใหญ่" });
  assert.ok("value" in r);
  assert.deepEqual(r.value.attachments.map((a) => [a.kind, a.label]), [["image", "a.png"], ["link", "plan.pdf"]]);
  assert.deepEqual(r.value.tags, ["#แอด", "#คลาสผู้ใหญ่"]);
});

test("validate: influencer requests need people; total fee comes from people when budget is empty", () => {
  assert.equal((validateRequestInput({ ...base, kind: "influencer" }) as { field: string }).field, "p_name.0");
  const r = validateRequestInput({
    ...base, kind: "influencer",
    "p_name.0": "ครูแนน", "p_platform.0": "tiktok", "p_fee.0": "15,000", "p_followers.0": "125000", "p_eng.0": "5.8",
    "p_name.1": "Racket Weekend", "p_platform.1": "instagram", "p_fee.1": "9000",
  });
  assert.ok("value" in r);
  assert.equal(r.value.people.length, 2);
  assert.equal(r.value.amountSatang, 2_400_000);
  assert.equal(r.value.people[0].engagementBps, 580);
  const bad = validateRequestInput({ ...base, kind: "influencer", "p_name.0": "A", "p_followers.0": "lots" });
  assert.equal((bad as { field: string }).field, "p_name.0");
});

test("money and counts", () => {
  assert.equal(parseBahtToSatang("฿1,071.50"), 107_150);
  assert.equal(parseBahtToSatang(""), null);
  assert.ok(Number.isNaN(parseBahtToSatang("1.234")));
  assert.equal(compactCount(125_000), "125K");
  assert.equal(compactCount(48_000), "48K");
  assert.equal(compactCount(1_500_000), "1.5M");
  assert.equal(refLabel(142), "#REQ-0142");
});

test("thaiRange and dueLabel", () => {
  assert.equal(thaiRange("2026-11-15", "2026-11-28"), "15–28 พ.ย. 2569");
  assert.equal(thaiRange("2026-11-15", "2026-12-15"), "15 พ.ย.–15 ธ.ค. 2569");
  assert.equal(thaiRange("2026-12-28", "2027-01-03"), "28 ธ.ค. 2569–3 ม.ค. 2570");
  assert.deepEqual(dueLabel("2026-11-09", "2026-11-08"), { text: "ภายในพรุ่งนี้ 9 พ.ย.", urgent: true, overdue: false });
  assert.equal(dueLabel("2026-11-12", "2026-11-08").urgent, false);
  assert.equal(dueLabel("2026-11-06", "2026-11-08").text, "เลยกำหนด 2 วัน");
});

test("ranges: bad or reversed input is ignored", () => {
  assert.deepEqual(parseRange("2026-11-10", "2026-11-17"), { from: "2026-11-10", to: "2026-11-17" });
  assert.equal(parseRange("2026-11-17", "2026-11-10"), null);
  assert.equal(parseRange("x", "2026-11-10"), null);
});

test("month grid is Sunday-first; November 2026 starts on a Sunday", () => {
  const w = monthCells("2026-11-01");
  assert.equal(w[0][0], "2026-11-01");
  assert.equal(w.length, 5);
  assert.equal(w[4][1], "2026-11-30");
  assert.equal(w[4][2], null);
  const dec = monthCells("2026-12-01");
  assert.deepEqual(dec[0].slice(0, 2), [null, null]); // 1 Dec 2026 is a Tuesday
  assert.equal(weekEndSunFirst("2026-11-08"), "2026-11-14");
});

test("promo bars stack overlapping promotions into lanes and clip to the week", () => {
  const week = monthCells("2026-11-01")[1]; // 8–14 Nov
  const bars = promoBars(week, [
    { key: "a", name: "A", start: "2026-11-02", end: "2026-11-20", color: "#1" },
    { key: "b", name: "B", start: "2026-11-09", end: "2026-11-13", color: "#2" },
    { key: "c", name: "C", start: "2026-11-22", end: "2026-11-28", color: "#3" },
  ]);
  assert.deepEqual(bars.map((b) => [b.key, b.col, b.span, b.lane, b.startsHere, b.endsHere]), [
    ["a", 0, 7, 0, false, false],
    ["b", 1, 5, 1, true, true],
  ]);
  const later = promoBars(monthCells("2026-11-01")[3], [{ key: "b", name: "B", start: "2026-11-09", end: "2026-11-13", color: "#2" }, { key: "d", name: "D", start: "2026-11-23", end: "2026-11-24", color: "#4" }]);
  assert.deepEqual(later.map((b) => [b.key, b.lane]), [["d", 0]]);
});

test("labels: initials and relative time in Bangkok", () => {
  assert.equal(initialsOf("มิ้นท์"), "มิ");
  assert.equal(initialsOf("คุณเอ"), "เอ");
  assert.equal(initialsOf("anya"), "A");
  const now = new Date("2026-11-08T09:52:00Z"); // 16:52 Bangkok
  assert.equal(bkkParts(now).time, "16:52");
  assert.equal(relTime(new Date(now.getTime() - 9 * 60_000), now), "9 นาทีที่แล้ว");
  assert.equal(relTime(new Date(now.getTime() - 61 * 60_000), now), "1 ชม.ที่แล้ว");
  assert.equal(relTime(new Date("2026-11-07T11:10:00Z"), now), "เมื่อวาน 18:10 น.");
  assert.equal(relTime(new Date("2026-11-06T07:20:00Z"), now), "6 พ.ย. 14:20 น.");
});
