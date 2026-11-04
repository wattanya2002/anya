// End-to-end checks for Home (S01) against a running server.
// usage: BASE=http://localhost:3100 OWNER_EMAIL=.. OWNER_PASSWORD=.. [MARKETING_EMAIL=.. MARKETING_PASSWORD=..] node tests/e2e/home.e2e.cjs
// Creates one task titled "E2E <timestamp>" and leaves it CANCELLED-free; the caller cleans it up.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const BASE = process.env.BASE;
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e.message.split("\n")[0]]); }
};

async function login(browser, email, password, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sign-in`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([page.waitForURL(`${BASE}/`), page.click("button[type=submit]")]);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();
  const title = `E2E ${Date.now()}`;

  await check("unauthenticated / redirects to /sign-in", async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    const r = await p.goto(`${BASE}/`);
    assert.match(p.url(), /\/sign-in$/);
    assert.ok(r.ok());
    await ctx.close();
  });

  await check("wrong password is rejected with Thai error", async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/sign-in`);
    await p.fill("#email", process.env.OWNER_EMAIL);
    await p.fill("#password", "definitely-wrong-password");
    await p.click("button[type=submit]");
    const msg = p.locator(".form-msg.err");
    await msg.waitFor();
    assert.match(await msg.innerText(), /ไม่ถูกต้อง/);
    assert.equal(await p.inputValue("#email"), process.env.OWNER_EMAIL); // entered value kept
    await ctx.close();
  });

  await check("forged session cookie is not accepted", async () => {
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "wc_session", value: "Fe26.2**forged", url: BASE }]);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/`);
    assert.match(p.url(), /\/sign-in$/);
    await ctx.close();
  });

  const { ctx, page } = await login(browser, process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD);

  await check("Home renders without demo data; empty states are explicit", async () => {
    assert.equal(await page.locator(".demo-badge").count(), 0, "demo badge must not show for real org");
    const text = await page.locator("main").innerText();
    if (process.env.EXPECT_EMPTY === "1") {
      assert.match(text, /ยังไม่มีข้อมูล/);
      assert.match(text, /ยังไม่ได้ตั้งค่าประเภทสนาม/);
      assert.match(text, /ยังไม่มีโปรโมชั่นที่กำลังใช้งาน/);
      assert.doesNotMatch(text, /428|317,400|82,540/); // no master/demo numbers
    }
  });

  await check("create a task → appears in today list and persists after reload", async () => {
    await page.getByRole("button", { name: "เพิ่มงานวันนี้" }).or(page.locator("summary[aria-label='เพิ่มงานวันนี้']")).first().click();
    await page.fill("#task-title", title);
    await page.fill("#task-time", "09:15");
    await page.getByRole("button", { name: "บันทึก" }).click();
    await page.getByText("เพิ่มงานแล้ว").waitFor();
    await page.reload();
    const row = page.locator(".task", { hasText: title });
    await row.waitFor();
    assert.match(await row.innerText(), /09:15 น\./);
  });

  await check("toggle task done → persists after reload; untoggle persists", async () => {
    const box = page.locator(".task", { hasText: title }).locator("input[type=checkbox]");
    await box.check();
    await page.waitForTimeout(1200);
    await page.reload();
    assert.equal(await page.locator(".task", { hasText: title }).locator("input[type=checkbox]").isChecked(), true);
    await page.locator(".task", { hasText: title }).locator("input[type=checkbox]").uncheck();
    await page.waitForTimeout(1200);
    await page.reload();
    assert.equal(await page.locator(".task", { hasText: title }).locator("input[type=checkbox]").isChecked(), false);
  });

  await check("empty task title is rejected server-side", async () => {
    await page.locator("summary[aria-label='เพิ่มงานวันนี้']").click();
    await page.fill("#task-title", "   ");
    await page.getByRole("button", { name: "บันทึก" }).click();
    await page.getByText("กรุณากรอกชื่องาน").waitFor({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await page.reload();
  });

  await check("range selector changes URL and keeps working", async () => {
    await page.selectOption("#range", "7");
    await page.waitForURL(/range=7/);
    assert.match(await page.locator("main").innerText(), /เทียบกับ 7 วันก่อน|ยังไม่มีข้อมูล/);
  });

  await check("search finds the created task", async () => {
    await page.fill("#global-search", title);
    await page.press("#global-search", "Enter");
    await page.waitForURL(/\/search\?q=/);
    assert.match(await page.locator("main").innerText(), new RegExp(title));
  });

  await check("module shortcut opens honest not-yet-available page", async () => {
    await page.goto(`${BASE}/modules/promotion`);
    assert.match(await page.locator("main").innerText(), /ยังไม่เปิดใช้งาน/);
    const r = await page.goto(`${BASE}/modules/does-not-exist`);
    assert.equal(r.status(), 404);
  });

  for (const [w, h] of [[375, 667], [390, 844], [393, 852], [430, 932], [820, 1180], [1024, 1366], [1280, 800], [1440, 900]]) {
    await check(`no horizontal overflow at ${w}px`, async () => {
      const c = await browser.newContext({ viewport: { width: w, height: h }, storageState: await ctx.storageState(), isMobile: w < 768, hasTouch: w < 768 });
      const p = await c.newPage();
      await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
      const { sw, cw } = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      assert.ok(sw <= cw, `scrollWidth ${sw} > ${cw}`);
      const small = await p.evaluate(() => [...document.querySelectorAll("input, select, textarea")].filter((el) => el.offsetParent && parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => el.id || el.name));
      assert.deepEqual(small, [], `inputs below 16px: ${small}`);
      await c.close();
    });
  }

  if (process.env.MARKETING_EMAIL) {
    await check("marketing role cannot see revenue (server-side)", async () => {
      const m = await login(browser, process.env.MARKETING_EMAIL, process.env.MARKETING_PASSWORD);
      const text = await m.page.locator("main").innerText();
      assert.match(text, /ไม่มีสิทธิ์ดูข้อมูลการเงิน/);
      await m.ctx.close();
    });
  }

  await check("sign out ends the session", async () => {
    await page.goto(`${BASE}/`);
    await page.locator("summary.profile").click();
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
    await page.waitForURL(/\/sign-in$/);
    await page.goto(`${BASE}/`);
    assert.match(page.url(), /\/sign-in$/);
  });

  await browser.close();
  for (const r of results) console.log(r.join(" | "));
  console.log(`E2E_TITLE=${title}`);
  const failed = results.filter((r) => r[0] === "FAIL").length;
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
