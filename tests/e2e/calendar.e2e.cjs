// Master Calendar end-to-end. usage: BASE=... OWNER_EMAIL=... OWNER_PASSWORD=... node tests/e2e/calendar.e2e.cjs
// Needs an org with tasks/promotions or the local demo seed for the "automatic events" check.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const BASE = process.env.BASE;
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e.message.split("\n")[0]]); } };
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
    await p.goto(`${BASE}/calendar`);
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

  await check("day view shows both items side by side and the conflict in the summary", async () => {
    await p.goto(`${BASE}/calendar?view=day&date=${today}`);
    const blocks = p.locator(".cal-block", { hasText: title });
    assert.equal(await blocks.count(), 2);
    const [a, c] = [await blocks.nth(0).boundingBox(), await blocks.nth(1).boundingBox()];
    assert.ok(Math.abs(a.x - c.x) > 20, "overlapping items get separate columns");
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

  await check("multi-day item renders as one continuous bar", async () => {
    await p.goto(`${BASE}/calendar?new=1&date=${today}`);
    await p.fill("#c-title", `ทัวร์นาเมนต์ ${T}`); await p.selectOption("#c-kind", "court_event");
    const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 2);
    await p.fill("#c-start", today); await p.fill("#c-end", end.toISOString().slice(0, 10));
    await p.check("input[name=allDay]");
    await p.click(".cal-form button[type=submit]");
    await p.locator(".form-msg.ok").waitFor({ timeout: 10000 });
    await p.goto(`${BASE}/calendar?date=${today}`);
    const bars = p.locator(".cal-bar", { hasText: `ทัวร์นาเมนต์ ${T}` });
    const n = await bars.count();
    const spans = await bars.evaluateAll((els) => els.map((e) => Number((e.style.gridColumn.match(/span (\d+)/) || [0, 1])[1])));
    assert.equal(spans.reduce((a, c) => a + c, 0), 3, `3 days across ${n} week row(s)`);
  });

  await check("filters: type + search, and Content Calendar is the content-only sub-view", async () => {
    await p.goto(`${BASE}/calendar?view=agenda&type=court_event`);
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

  await check("week and agenda views render; week navigation moves 7 days", async () => {
    await p.goto(`${BASE}/calendar?view=week&date=${today}`);
    assert.equal(await p.locator(".cal-wv-day").count(), 7);
    const before = await p.locator(".cal-period").innerText();
    const next = new Date(`${today}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 7);
    await p.click("a[aria-label=ถัดไป]"); await p.waitForURL(new RegExp(`date=${next.toISOString().slice(0, 10)}`));
    assert.notEqual(await p.locator(".cal-period").innerText(), before);
  });

  await check("iPhone: compact month, tap a day to list its items, page never scrolls", async () => {
    const m = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState(), isMobile: true, hasTouch: true });
    const mp = await m.newPage();
    await mp.goto(`${BASE}/calendar?date=${today}`);
    assert.ok(await mp.locator(".cal-pick").first().isVisible());
    assert.equal(await mp.locator(".cal-bar").first().isVisible(), false);
    await mp.locator(".cal-pick").nth(10).click(); await mp.waitForURL(/date=/);
    assert.ok(await mp.locator(".cal-dayagenda").isVisible());
    const sy = await mp.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
    assert.ok(sy <= 0, `page scroll ${sy}`);
    await mp.goto(`${BASE}/calendar?new=1`);
    const fs = await mp.locator("#c-start").evaluate((e) => getComputedStyle(e).fontSize);
    assert.equal(fs, "16px", "no iOS zoom on focus");
    assert.ok(await mp.locator("#c-title").isVisible(), "form opens on its tab");
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
    await p.goto(`${BASE}/calendar?date=2026-11-24`);
    const cell = p.locator(".cal-cell.hol", { has: p.locator(".cal-hol", { hasText: "วันลอยกระทง" }) });
    assert.equal(await cell.count(), 1);
    assert.equal(await cell.locator(".cal-hol svg").count(), 1, "festival icon");
    const bg = await cell.evaluate((e) => getComputedStyle(e).getPropertyValue("--hb").trim());
    assert.equal(bg, "#e6ebf8", "Loy Krathong tint");
    await cell.locator(".cal-hol").click();
    await p.waitForURL(/holiday=2026-11-24/);
    const side = await p.locator(".cal-side").innerText();
    assert.match(side, /วันลอยกระทง[\s\S]*ไม่ใช่วันหยุดราชการ[\s\S]*สีประจำวัน[\s\S]*น้ำเงินคืนเพ็ญ-ทอง/);
  });

  await check("holidays: day off is marked, compensation day listed, toggle hides them", async () => {
    await p.goto(`${BASE}/calendar?date=2026-12-07`);
    assert.equal(await p.locator(".cal-cell.off").count() >= 4, true, "5, 7, 10, 31 Dec are days off");
    await p.goto(`${BASE}/calendar?view=agenda&date=2026-12-01`);
    assert.match(await p.locator(".cal-main").innerText(), /ชดเชยวันพ่อแห่งชาติ[\s\S]*หยุดราชการและธนาคาร/);
    await p.goto(`${BASE}/calendar?date=2026-12-07&hol=0`);
    assert.equal(await p.locator(".cal-cell.hol").count(), 0);
    assert.equal(await p.locator("input[name=hol][type=checkbox]").isChecked(), false);
  });

  await check("holidays: iPhone compact month shows the icon, day list shows the holiday", async () => {
    const m = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
    const mp = await m.newPage();
    await mp.goto(`${BASE}/calendar?date=2026-12-07`);
    assert.ok(await mp.locator(".cal-pick-hol").count() >= 4);
    assert.match(await mp.locator(".cal-dayagenda").innerText(), /ชดเชยวันพ่อแห่งชาติ/);
    assert.equal(await mp.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight), 0);
    await m.close();
  });

  await check("holidays: years without checked data show a notice instead of guessing", async () => {
    await p.goto(`${BASE}/calendar?date=2028-03-01`);
    assert.equal(await p.locator(".cal-cell.hol").count(), 0);
    assert.match(await p.locator(".cal-side").innerText(), /ยังไม่มีข้อมูลวันหยุดปี 2571/);
  });

  await check("no client errors", async () => assert.deepEqual(errors, []));

  // cleanup the multi-day test item
  await p.goto(`${BASE}/calendar?view=agenda&q=${encodeURIComponent(`ทัวร์นาเมนต์ ${T}`)}`);
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
