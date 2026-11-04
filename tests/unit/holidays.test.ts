import { test } from "node:test";
import assert from "node:assert/strict";
import { HOLIDAYS, HOLIDAY_YEARS, THEMES, endOf, findHoliday, holidayKey, holidaysIn, holidaysOn, isDayOff, missingYears } from "../../lib/holidays-th.ts";

const wd = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday

test("holiday data is well-formed and inside the covered years", () => {
  for (const h of HOLIDAYS) {
    assert.match(h.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(`${h.date}T00:00:00Z`).toISOString().slice(0, 10), h.date, h.name);
    assert.ok(endOf(h) >= h.date, h.name);
    assert.ok((HOLIDAY_YEARS as readonly number[]).includes(Number(h.date.slice(0, 4))), h.name);
    assert.ok(THEMES[h.theme], h.name);
    if (h.type !== "holiday") assert.equal(h.off, null, `${h.name} is not a day off`);
  }
});

test("compensation days fall on a weekday right after a weekend holiday", () => {
  for (const h of HOLIDAYS.filter((x) => x.name.startsWith("ชดเชย"))) {
    assert.ok(wd(h.date) >= 1 && wd(h.date) <= 2, `${h.name} ${h.date} should be Mon/Tue`);
  }
});

test("known anchor dates (official announcements)", () => {
  const on = (d: string) => holidaysOn(HOLIDAYS, d).map((h) => h.name);
  assert.ok(on("2026-11-24").includes("วันลอยกระทง"));
  assert.ok(on("2026-12-07").includes("ชดเชยวันพ่อแห่งชาติ"));
  assert.ok(on("2026-04-14").includes("เทศกาลสงกรานต์"), "Songkran is a 3-day range");
  assert.ok(on("2027-02-22").includes("ชดเชยวันมาฆบูชา"));
  assert.ok(on("2027-11-13").includes("วันลอยกระทง"));
  assert.equal(wd("2026-01-10"), 6, "Children's Day is a Saturday");
  assert.equal(wd("2027-01-09"), 6, "Children's Day is a Saturday");
});

test("day-off logic, pending days and keys", () => {
  assert.equal(isDayOff(holidaysOn(HOLIDAYS, "2026-11-24")), false, "Loy Krathong is not a day off");
  assert.equal(isDayOff(holidaysOn(HOLIDAYS, "2026-12-10")), true);
  assert.equal(isDayOff(holidaysOn(HOLIDAYS, "2027-07-20")), false, "pending cabinet decision is not shown as a day off");
  const h = holidaysOn(HOLIDAYS, "2026-12-31")[0];
  assert.equal(findHoliday(holidayKey(h)), h);
  assert.equal(findHoliday("nope"), null);
});

test("range queries and missing-year notice", () => {
  const nov = holidaysIn("2026-11-01", "2026-11-30");
  assert.deepEqual(nov.map((h) => h.date), ["2026-11-24"]);
  assert.ok(holidaysIn("2026-04-15", "2026-04-20").some((h) => h.name === "เทศกาลสงกรานต์"), "overlap on the last day");
  assert.deepEqual(missingYears("2027-12-28", "2028-01-31"), [2028]);
  assert.deepEqual(missingYears("2026-11-01", "2026-12-31"), []);
});
