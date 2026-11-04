// Master Calendar end-to-end. usage: BASE=... OWNER_EMAIL=... OWNER_PASSWORD=... node tests/e2e/calendar.e2e.cjs
// Needs an org with tasks/promotions or the local demo seed for the "automatic events" check.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const BASE = process.env.BASE;
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e.message.replace(/\n+/g, " ").slice(0, 300)]); } };
const T = Date.now().toString(36).toUpperCase();
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors = []; p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${BASE}/sign-in`); await p.fill("#email", process.env.OWNER_EMAIL); await p.fill("#password", process.env.OWNER_PASSWORD);
  await Promise.all([p.waitForURL(`${BASE}/`), p.click("button[type=submit]")]);

  await check("calendar is menu item #2 on the rail and in the iPhone bottom nav", async () => {
    assert.equal(await p.locator(".rail a").nth(1).getAttribute("href"), "/calendar");
    assert.equal(await p.locator(".bottom-nav > a").nth(1).getAttribute("href"), "/calendar");
  });

  await check("month view renders with week summary and colour legend", async () => {
    await p.goto(`${BASE}/calendar?view=month`);
    assert.equal(await p.locator(".seg a[aria-current=page]").innerText(), "เดือน");
    assert.ok(await p.locator(".cal-wk").count() >= 4);
    assert.match(await p.locator(".cal-side").innerText(), /ภาระงานสัปดาห์นี้[\s\S]*เวลาซ้อนกัน[\s\S]*สีของรายการ/);
  });

  await check("automatic items from source modules appear (tasks / promotions / campaigns)", async () => {
    await p.goto(`${BASE}/calendar?view=agenda`);
    const txt = await p.locator(".cal-main").innerText();
    assert.match(txt, /งาน\/Deadline|โปรโมชั่น|แคมเปญ/);
  });

  const title = `ประชุมทดสอบ ${T}`;
  await check("add item: native date/time fields, saved, conflict warning shown", async () => {
    await p.goto(`${BASE}/calendar?new=1&date=${today}`);
    assert.equal(await p.locator("#c-start").getAttribute("type"), "date");
    assert.equal(await p.locator("#c-st").getAttribute("type"), "time");
    await p.fill("#c-title", title);
    await p.selectOption("#c-kind", "appointment");
    await p.fill("#c-start", today);
    await p.fill("#c-st", "08:00"); await p.fill("#c-et", "09:00");
    await p.click(".cal-form button[type=submit]");
    await p.locator(".form-msg.ok").waitFor({ timeout: 10000 });
    // a second item overlapping the first must warn
    await p.goto(`${BASE}/calendar?new=1&date=${today}`);
    await p.fill("#c-title", `${title} ซ้อน`); await p.fill("#c-start", today);
    await p.fill("#c-st", "08:30"); await p.fill("#c-et", "09:30");
    await p.click(".cal-form button[type=submit]");
    await p.locator(".form-msg.warn").waitFor({ timeout: 10000 });
    assert.match(await p.locator(".form-msg.warn").innerText(), new RegExp(`เวลาซ้อนกับ: ${title}`));
  });

  await check("validation: end time before start is rejected with a Thai message", async () => {
    await p.goto(`${BASE}/calendar?new=1`);
    await p.fill("#c-title", "ผิดเวลา"); await p.fill("#c-start", today);
    await p.fill("#c-st", "10:00"); await p.fill("#c-et", "09:00");
    await p.click(".cal-form button[type=submit]");
    await p.locator(".form-msg.err").waitFor({ timeout: 10000 });
    assert.match(await p.locator(".form-msg.err").innerText(), /เวลาสิ้นสุดต้องหลังเวลาเริ่ม/);
    assert.equal(await p.inputValue("#c-title"), "ผิดเวลา", "typed values are kept");
  });

  await check("day view lists both overlapping items in time order; the conflict shows in the weekly summary", async () => {
    await p.goto(`${BASE}/calendar?date=${today}`);
    const cards = p.locator(".pd-card", { hasText: title });
    assert.equal(await cards.count(), 2);
    const [a, c] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
    assert.ok(c.y > a.y, "timed items are stacked chronologically");
    await p.goto(`${BASE}/calendar?date=${today}&sheet=summary`);
    assert.match(await p.locator(".cal-side").innerText(), new RegExp(`${title}[\\s\\S]*↔`));
  });

  await check("detail → edit → mark done → delete (with audit-safe server actions)", async () => {
    await p.goto(`${BASE}/calendar?view=agenda&q=${encodeURIComponent(`${title} ซ้อน`)}`);
    await p.locator(".cal-row", { hasText: `${title} ซ้อน` }).first().click();
    await p.waitForURL(/item=ev%3A|item=ev:/);
    await p.locator(".cal-side a", { hasText: "แก้ไข" }).click();
    await p.waitForURL(/edit=/);
    await p.fill("#c-title", `${title} แก้แล้ว`);
    await p.click(".cal-form button[type=submit]");
    await p.locator(".form-msg.ok").waitFor({ timeout: 10000 });
    await p.goto(`${BASE}/calendar?view=agenda&q=${encodeURIComponent(`${title} แก้แล้ว`)}`);
    await p.locator(".cal-row", { hasText: `${title} แก้แล้ว` }).first().click();
    await p.locator("button", { hasText: "ทำเครื่องหมายว่าเสร็จ" }).click();
    await p.locator(".cal-side .cal-status.st-done").waitFor({ timeout: 10000 });
    await p.locator("button", { hasText: "ลบรายการ" }).click();
    await p.waitForURL((u) => !u.searchParams.has("item"));
    await p.goto(`${BASE}/calendar?view=agenda&q=${encodeURIComponent(`${title} แก้แล้ว`)}`);
    assert.match(await p.locator(".cal-main").innerText(), /ไม่มีรายการในช่วงนี้/);
  });

  await check("multi-day item: one record, start-day chip, soft continuation on the following days", async () => {
    // a quiet date (no holidays or seeded items) so the start-day chip is not pushed into "+N"
    const d0 = "2027-03-08", d2 = "2027-03-10";
    await p.goto(`${BASE}/calendar?new=1&date=${d0}`);
    await p.fill("#c-title", `ทัวร์นาเมนต์ ${T}`); await p.selectOption("#c-kind", "court_event");
    await p.fill("#c-start", d0); await p.fill("#c-end", d2);
    await p.check("input[name=allDay]");
    await p.click(".cal-form button[type=submit]");
    await p.locator(".form-msg.ok").waitFor({ timeout: 10000 });
    await p.goto(`${BASE}/calendar?view=month&date=${d0}`);
    assert.equal(await p.locator(".pm-chip", { hasText: `ทัวร์นาเมนต์ ${T}` }).count(), 1, "one chip, on the start day");
    assert.match(await p.locator(`.pm-cell[href*="date=${d0}"]`).getAttribute("aria-label"), new RegExp(`ทัวร์นาเมนต์ ${T} .+ ถึง `), "accessible range label");
    for (const d of ["2027-03-09", "2027-03-10"]) assert.ok(await p.locator(`.pm-cell[href*="date=${d}"] .pm-dots i`).count() >= 1, `continuation dot on ${d}`);
    await p.goto(`${BASE}/calendar?date=2027-03-09`);
    assert.match(await p.locator(".pd").innerText(), new RegExp(`ทัวร์นาเมนต์ ${T}[\\s\\S]*กำลังใช้งาน`), "Day shows the ongoing occurrence");
  });

  await check("filters: type + search, and Content Calendar is the content-only sub-view", async () => {
    await p.goto(`${BASE}/calendar?view=agenda&days=90&date=2027-03-01&type=court_event`);
    const txt = await p.locator(".cal-main").innerText();
    assert.match(txt, new RegExp(`ทัวร์นาเมนต์ ${T}`));
    assert.doesNotMatch(txt, /งาน\/Deadline/);
    await p.goto(`${BASE}/calendar/content?view=agenda`);
    assert.match(await p.locator(".cal-title").innerText(), /Content Calendar/);
    const ct = await p.locator(".cal-main").innerText();
    assert.doesNotMatch(ct, new RegExp(`ทัวร์นาเมนต์ ${T}`));
    await p.goto(`${BASE}/calendar/content?new=1`);
    assert.equal(await p.inputValue("#c-kind"), "content");
  });

  await check("filters apply on change (no extra click) and fit one row on PC", async () => {
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.goto(`${BASE}/calendar?view=agenda`);
    await Promise.all([p.waitForURL(/type=court_event/), p.selectOption("#cf-type", "court_event")]);
    const rows = await p.locator(".cal-filters > *:not(.cal-apply):not(input)").evaluateAll((els) => new Set(els.filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().top))).size);
    assert.equal(rows, 1, "filters on one line at 1280px");
    assert.ok(await p.locator(".cal-filters").evaluate((e) => e.scrollWidth <= e.clientWidth), "filters do not overflow into the side panel");
    await p.setViewportSize({ width: 1440, height: 900 });
  });

  await check("week and agenda views render; week navigation moves 7 days", async () => {
    await p.goto(`${BASE}/calendar?view=week&date=${today}`);
    assert.equal(await p.locator(".cal-wv-day").count(), 7);
    const before = await p.locator(".cal-period").innerText();
    const next = new Date(`${today}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 7);
    await p.click("a[aria-label=ถัดไป]"); await p.waitForURL(new RegExp(`date=${next.toISOString().slice(0, 10)}`));
    assert.notEqual(await p.locator(".cal-period").innerText(), before);
  });

  await check("iPhone (RCM v1.1): Day is the default, view switch keeps the date, Month only selects, page never scrolls", async () => {
    const m = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState(), isMobile: true, hasTouch: true });
    const mp = await m.newPage();
    const scroll = () => mp.evaluate(() => [document.documentElement.scrollWidth - document.documentElement.clientWidth, document.documentElement.scrollHeight - document.documentElement.clientHeight]);
    await mp.goto(`${BASE}/calendar`);
    assert.ok(await mp.locator(".pd").isVisible(), "Day view is the default");
    assert.equal(await mp.locator(".cal-mtitle").innerText(), "วันนี้");
    const weekday = new Intl.DateTimeFormat("th-TH", { weekday: "long", timeZone: "Asia/Bangkok" }).format(new Date()).replace(/^วัน/, "");
    assert.ok((await mp.locator(".cal-mcap").innerText()).startsWith(`${weekday},`), "weekday computed from the real date");
    assert.equal(Number(await mp.locator(".pd-strip a[aria-current=date] .pd-num").innerText()), Number(today.slice(8)));
    assert.ok(await mp.locator(".pd-fab").isVisible(), "FAB on Day");
    assert.deepEqual(await scroll(), [0, 0]);
    // Day -> Month keeps the selected date
    const pick = today.slice(8) === "15" ? "16" : "15";
    const target = `${today.slice(0, 8)}${pick}`;
    await mp.goto(`${BASE}/calendar?date=${target}`);
    await mp.click(".vp-btn"); await Promise.all([mp.waitForURL(/view=month/), mp.click(".vp-menu >> text=รายเดือน")]);
    assert.match(mp.url(), new RegExp(`date=${target}`));
    assert.equal(Number(await mp.locator(".pm-cell[aria-current=date] .pm-num").innerText()), Number(pick));
    assert.equal(await mp.locator(".pd-fab").count(), 0, "no FAB on Month");
    // equal columns / rows, bold dates, regular chips, nothing listed under the grid
    const geo = await mp.locator(".pm-cell").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width * 10), Math.round(r.height * 10)]; }));
    assert.equal(new Set(geo.map((g) => g[0])).size, 1, "7 equal columns"); assert.equal(new Set(geo.map((g) => g[1])).size, 1, "equal row heights");
    assert.equal(await mp.locator(".pm-cell:not(.out) .pm-num").first().evaluate((e) => getComputedStyle(e).fontWeight), "700");
    if (await mp.locator(".pm-chip").count()) assert.equal(await mp.locator(".pm-chip").first().evaluate((e) => getComputedStyle(e).fontWeight), "400");
    assert.equal(await mp.locator(".cal-dayagenda, .cal-sheet").count(), 0, "no agenda under the month");
    // tapping a date only selects it
    const other = `${today.slice(0, 8)}${pick === "15" ? "17" : "18"}`;
    await Promise.all([mp.waitForURL(new RegExp(`date=${other}`)), mp.locator(`.pm-cell[href*="date=${other}"]`).click()]);
    assert.match(mp.url(), /view=month/, "stays on Month");
    assert.equal(Number(await mp.locator(".pm-cell.sel .pm-num").innerText()), Number(other.slice(8)));
    assert.deepEqual(await scroll(), [0, 0]);
    // Month -> Day keeps it too
    await mp.click(".vp-btn"); await Promise.all([mp.waitForURL((u) => !u.searchParams.has("view")), mp.click(".vp-menu >> text=รายวัน")]);
    assert.equal(Number(await mp.locator(".pd-strip a[aria-current=date] .pd-num").innerText()), Number(other.slice(8)));
    // FAB opens the form as a sheet; native inputs at 16px; short title field
    await Promise.all([mp.waitForURL(/new=1/), mp.click(".pd-fab")]);
    assert.ok(await mp.locator(".cal-side #c-title").isVisible());
    assert.equal(await mp.locator("#c-start").evaluate((e) => getComputedStyle(e).fontSize), "16px", "no iOS zoom on focus");
    assert.equal(await mp.locator("#c-start").inputValue(), other, "start date = selected date");
    assert.ok(await mp.locator("#c-short").isVisible());
    await mp.keyboard.press("Escape"); await mp.waitForURL((u) => !u.searchParams.has("new"));
    await m.close();
  });

  await check("iPhone: tapping a card opens its detail sheet; month cells stay inside their column at 375px", async () => {
    const m = await b.newContext({ viewport: { width: 375, height: 812 }, storageState: await ctx.storageState(), isMobile: true, hasTouch: true });
    const mp = await m.newPage();
    await mp.goto(`${BASE}/calendar?date=${today}`);
    if (await mp.locator(".pd-link").count()) {
      await Promise.all([mp.waitForURL(/item=|holiday=/), mp.locator(".pd-link").first().click()]);
      assert.equal(await mp.locator(".cal-side").evaluate((e) => getComputedStyle(e).position), "fixed");
      assert.ok(await mp.locator(".cal-side").isVisible());
    }
    await mp.goto(`${BASE}/calendar?view=month&date=${today}`);
    const spill = await mp.locator(".pm-cell").evaluateAll((cells) => cells.filter((c) => [...c.querySelectorAll(".pm-chip")].filter((ch) => ch.getClientRects().length).some((ch) => { const a = c.getBoundingClientRect(), r = ch.getBoundingClientRect(); return r.left < a.left - 0.5 || r.right > a.right + 0.5; })).length);
    assert.equal(spill, 0, "no chip spills into the next day");
    await m.close();
  });

  await check("in-app alerts land in notifications, once per alert (needs the demo seed's content item today)", async () => {
    await p.goto(`${BASE}/calendar`); await p.goto(`${BASE}/`);
    const html = await p.locator(".topbar").innerHTML();
    const n = (html.match(/ถึงวันโพสต์แต่ยังไม่อนุมัติ/g) || []).length;
    assert.equal(n, 1, `alert notifications found: ${n}`);
  });

  await check("holidays: festival icon + colour in the month cell, detail shows the day colour", async () => {
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.goto(`${BASE}/calendar?view=month&date=2026-11-24`);
    const chip = p.locator(".pm-chip.hol", { hasText: "ลอยกระทง" });
    assert.equal(await chip.count(), 1);
    assert.equal(await chip.locator("svg").count(), 1, "festival icon");
    const bg = await chip.evaluate((e) => getComputedStyle(e).getPropertyValue("--hb").trim());
    assert.equal(bg, "#e6ebf8", "Loy Krathong tint");
    await p.goto(`${BASE}/calendar?date=2026-11-24`);
    await Promise.all([p.waitForURL(/holiday=2026-11-24/), p.locator(".pd-card.hol .pd-link").first().click()]);
    const side = await p.locator(".cal-side").innerText();
    assert.match(side, /วันลอยกระทง[\s\S]*ไม่ใช่วันหยุดราชการ[\s\S]*สีประจำวัน[\s\S]*น้ำเงินคืนเพ็ญ-ทอง/);
  });

  await check("holidays: day off is marked, compensation day listed, toggle hides them", async () => {
    await p.goto(`${BASE}/calendar?view=month&date=2026-12-07`);
    assert.equal(await p.locator(".pm-cell.off").count() >= 4, true, "5, 7, 10, 31 Dec are days off");
    await p.goto(`${BASE}/calendar?view=agenda&date=2026-12-01`);
    assert.match(await p.locator(".cal-main").innerText(), /ชดเชยวันพ่อแห่งชาติ[\s\S]*หยุดราชการและธนาคาร/);
    await p.goto(`${BASE}/calendar?view=month&date=2026-12-07&hol=0`);
    assert.equal(await p.locator(".pm-chip.hol").count(), 0);
    assert.equal(await p.locator("input[name=hol][type=checkbox]").isChecked(), false);
  });

  await check("holidays: iPhone month shows holiday chips, Day lists the holiday", async () => {
    const m = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
    const mp = await m.newPage();
    await mp.goto(`${BASE}/calendar?view=month&date=2026-12-07`);
    assert.ok(await mp.locator(".pm-chip.hol").count() >= 4);
    await mp.goto(`${BASE}/calendar?date=2026-12-07`);
    assert.match(await mp.locator(".pd").innerText(), /ชดเชยวันพ่อแห่งชาติ/);
    assert.equal(await mp.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight), 0);
    await m.close();
  });

  await check("holidays: years without checked data show a notice instead of guessing", async () => {
    await p.goto(`${BASE}/calendar?view=month&date=2028-03-01&sheet=summary`);
    assert.equal(await p.locator(".pm-chip.hol").count(), 0);
    assert.match(await p.locator(".cal-side").innerText(), /ยังไม่มีข้อมูลวันหยุดปี 2571/);
  });

  await check("no client errors", async () => assert.deepEqual(errors, []));

  // cleanup the multi-day test item
  await p.goto(`${BASE}/calendar?view=agenda&date=2027-03-01&q=${encodeURIComponent(`ทัวร์นาเมนต์ ${T}`)}`);
  if (await p.locator(".cal-main .cal-row").count()) {
    await p.locator(".cal-main .cal-row").first().click();
    await p.locator("button", { hasText: "ลบรายการ" }).click();
    await p.waitForURL((u) => !u.searchParams.has("item"));
  }
  await p.goto(`${BASE}/calendar?view=agenda&q=${encodeURIComponent(title)}`);
  while (await p.locator(".cal-main .cal-row").count()) {
    await p.locator(".cal-main .cal-row").first().click();
    await p.locator("button", { hasText: "ลบรายการ" }).click();
    await p.waitForURL((u) => !u.searchParams.has("item"));
    await p.goto(`${BASE}/calendar?view=agenda&q=${encodeURIComponent(title)}`);
  }
  await b.close();
  for (const r of results) console.log(r.join(" | "));
  console.log(`${results.filter((r) => r[0] === "PASS").length}/${results.length} passed`);
  process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
})();
