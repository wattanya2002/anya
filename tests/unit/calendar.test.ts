import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths, expandOccurrences, findConflicts, layoutWeek, manualStatus, monthWeeks, rangeFor, shiftDate, validateEventInput,
  weeklyWorkload, applyFilters, dayColumns, type CalItem,
} from "../../lib/calendar-core.ts";

const item = (p: Partial<CalItem>): CalItem => ({
  key: p.key ?? Math.random().toString(36), sourceKey: "ev:x", source: "manual", kind: "appointment", title: "t",
  start: "2026-11-02", end: "2026-11-02", startTime: null, endTime: null, status: "planned", ownerId: null, ownerName: null,
  createdBy: "u1", href: null, hrefLabel: null, editable: true, ...p,
});

test("month grid is Monday-first and covers the whole month", () => {
  const w = monthWeeks("2026-11-15");
  assert.equal(w[0][0], "2026-10-26"); // Monday before 1 Nov 2026 (a Sunday)
  assert.equal(w[w.length - 1][6], "2026-12-06");
  assert.ok(w.every((wk) => wk.length === 7));
  assert.deepEqual(rangeFor("week", "2026-11-04"), { from: "2026-11-02", to: "2026-11-08" });
  assert.equal(shiftDate("month", "2026-01-31", 1), "2026-02-01");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
});

test("repeating items expand inside the window only", () => {
  const weekly = { start: "2026-10-05", end: "2026-10-05", repeat: "weekly" as const, repeatUntil: null };
  assert.deepEqual(expandOccurrences(weekly, "2026-11-01", "2026-11-30").map((o) => o.start), ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
  const until = { ...weekly, repeatUntil: "2026-11-10" };
  assert.deepEqual(expandOccurrences(until, "2026-11-01", "2026-11-30").map((o) => o.start), ["2026-11-02", "2026-11-09"]);
  const monthly31 = { start: "2026-01-31", end: "2026-01-31", repeat: "monthly" as const, repeatUntil: null };
  assert.deepEqual(expandOccurrences(monthly31, "2026-01-01", "2026-05-31").map((o) => o.start), ["2026-01-31", "2026-03-31", "2026-05-31"]);
  const multi = { start: "2026-10-30", end: "2026-11-01", repeat: "none" as const };
  assert.equal(expandOccurrences(multi, "2026-11-01", "2026-11-30").length, 1, "multi-day item overlapping the window start");
  const daily = { start: "2020-01-01", end: "2020-01-01", repeat: "daily" as const, repeatUntil: null };
  assert.equal(expandOccurrences(daily, "2026-11-01", "2026-11-07").length, 7, "long series jump to the window");
});

test("multi-day items become continuous bars with lanes and continuation flags", () => {
  const a = item({ key: "a", start: "2026-10-30", end: "2026-11-04" });
  const b = item({ key: "b", start: "2026-11-03", end: "2026-11-03" });
  const c = item({ key: "c", start: "2026-11-05", end: "2026-11-12" });
  const segs = layoutWeek([b, a, c], "2026-11-02");
  const byKey = Object.fromEntries(segs.map((s) => [s.item.key, s]));
  assert.deepEqual([byKey.a.col, byKey.a.span, byKey.a.lane, byKey.a.fromBefore, byKey.a.toAfter], [0, 3, 0, true, false]);
  assert.equal(byKey.b.lane, 1, "overlaps a → second lane");
  assert.deepEqual([byKey.c.col, byKey.c.span, byKey.c.lane, byKey.c.toAfter], [3, 4, 0, true]);
});

test("conflicts: overlapping timed items only; tasks, cancelled and touching items excluded", () => {
  const m = item({ key: "m", title: "ประชุม", startTime: "10:00", endTime: "11:00" });
  const shoot = item({ key: "s", title: "ถ่ายคลิป", startTime: "10:30", endTime: "12:00" });
  const after = item({ key: "x", startTime: "11:00", endTime: "11:30" });
  const task = item({ key: "t", source: "task", kind: "task", startTime: "10:15" });
  const cancelled = item({ key: "c", startTime: "10:00", endTime: "12:00", status: "cancelled" });
  const pairs = findConflicts([m, shoot, after, task, cancelled]).map(([a, b]) => [a.key, b.key].sort().join("+")).sort();
  assert.deepEqual(pairs, ["m+s", "s+x"]);
  const overnight = item({ key: "o", start: "2026-11-02", end: "2026-11-03", startTime: "22:00", endTime: "02:00" });
  const early = item({ key: "e", start: "2026-11-03", end: "2026-11-03", startTime: "01:00", endTime: "01:30" });
  assert.equal(findConflicts([overnight, early]).length, 1, "multi-day timed items compare across midnight");
});

test("day view columns split overlapping items side by side", () => {
  const cols = dayColumns([
    item({ key: "a", startTime: "10:00", endTime: "11:00" }), item({ key: "b", startTime: "10:30", endTime: "11:30" }),
    item({ key: "c", startTime: "13:00", endTime: "14:00" }),
  ], "2026-11-02");
  const k = Object.fromEntries(cols.map((c) => [c.item.key, c]));
  assert.deepEqual([k.a.col, k.a.cols, k.b.col, k.b.cols, k.c.cols], [0, 2, 1, 2, 1]);
  assert.equal(k.a.top, 600);
});

test("weekly workload counts work items, overdue, approvals and the busiest day", () => {
  const items = [
    item({ start: "2026-11-02", status: "done" }), item({ start: "2026-11-02", status: "overdue" }), item({ start: "2026-11-04" }),
    item({ source: "promotion", kind: "promotion", start: "2026-10-01", end: "2026-12-31", status: "in_progress" }), // running promo: not workload
    item({ source: "promotion", kind: "promotion", start: "2026-11-05", end: "2026-11-20", status: "pending_approval" }),
    item({ start: "2026-11-03", status: "cancelled" }), item({ start: "2026-11-10" }),
  ];
  const w = weeklyWorkload(items, "2026-11-05");
  assert.deepEqual([w.from, w.to, w.total, w.done, w.overdue, w.pending], ["2026-11-02", "2026-11-08", 4, 1, 1, 1]);
  assert.deepEqual(w.busiest, { date: "2026-11-02", count: 2 });
});

test("manual status: unfinished past work is overdue, past appointments are not", () => {
  assert.equal(manualStatus("general", "planned", "2026-11-01", "2026-11-02"), "overdue");
  assert.equal(manualStatus("appointment", "planned", "2026-11-01", "2026-11-02"), "planned");
  assert.equal(manualStatus("report", "done", "2026-11-01", "2026-11-02"), "done");
  assert.equal(manualStatus("general", "planned", "2026-11-02", "2026-11-02"), "planned");
});

test("filters: type, my items and search", () => {
  const items = [item({ key: "1", kind: "content", title: "โพสต์ IG", ownerId: "me" }), item({ key: "2", kind: "promotion", title: "โปร", ownerId: "you" }), item({ key: "3", title: "นัด", ownerId: null, createdBy: "me" })];
  const base = { kinds: [], owner: null, status: null, mine: false, q: "" };
  assert.deepEqual(applyFilters(items, { ...base, kinds: ["content"] }, "me").map((i) => i.key), ["1"]);
  assert.deepEqual(applyFilters(items, { ...base, mine: true }, "me").map((i) => i.key), ["1", "3"]);
  assert.deepEqual(applyFilters(items, { ...base, q: "ig" }, "me").map((i) => i.key), ["1"]);
});

test("add-item form validation", () => {
  const opts = { memberIds: ["11111111-1111-1111-1111-111111111111"], canFollowup: false };
  const ok = validateEventInput({ title: " ประชุมทีม ", kind: "appointment", startDate: "2026-11-02", startTime: "10:00", endTime: "11:00", repeat: "weekly", repeatUntil: "2026-12-31", ownerId: opts.memberIds[0], status: "planned", remind: "30", visibility: "team", linkUrl: "https://drive.google.com/x" }, opts);
  assert.ok("value" in ok);
  if ("value" in ok) {
    assert.equal(ok.value.title, "ประชุมทีม");
    assert.equal(ok.value.end, "2026-11-02", "empty end date = same day");
    assert.equal(ok.value.allDay, false);
    assert.equal(ok.value.remindMinutes, 30);
  }
  const allDay = validateEventInput({ title: "Open", kind: "court_event", startDate: "2026-11-08", endDate: "2026-11-10", allDay: "on", startTime: "10:00" }, opts);
  assert.ok("value" in allDay && allDay.value.startTime === null, "all-day ignores times");
  const err = (f: Record<string, string>) => { const r = validateEventInput({ title: "x", kind: "general", startDate: "2026-11-02", startTime: "09:00", ...f }, opts); return "error" in r ? r.error : ""; };
  assert.match(err({ title: "" }), /ชื่อรายการ/);
  assert.match(err({ endDate: "2026-11-01" }), /ไม่ก่อนวันที่เริ่ม/);
  assert.match(err({ startTime: "10:00", endTime: "09:00" }), /หลังเวลาเริ่ม/);
  assert.match(err({ startTime: "" }), /เวลาเริ่ม/);
  assert.match(err({ startDate: "2026-02-30" }), /วันที่เริ่ม/);
  assert.match(err({ ownerId: "22222222-2222-2222-2222-222222222222" }), /สมาชิกทีม/);
  assert.match(err({ kind: "followup" }), /ไม่มีสิทธิ์/);
  assert.match(err({ linkUrl: "javascript:alert(1)" }), /https/);
  assert.match(err({ remind: "7" }), /แจ้งเตือน/);
  assert.match(err({ visibility: "public" }), /ส่วนตัว/);
});
