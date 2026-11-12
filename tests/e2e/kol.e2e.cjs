// End-to-end checks for KOL Recruitment & Marketing Approval (Master RCM §17, tests A–F) against a running server.
// usage: BASE=http://localhost:3100 OWNER_EMAIL=.. OWNER_PASSWORD=.. MARKETING_EMAIL=.. MARKETING_PASSWORD=.. CEO_EMAIL=.. CEO_PASSWORD=..
//        [INVENTORY_EMAIL=.. INVENTORY_PASSWORD=..] [PREFIX="E2E"] node tests/e2e/kol.e2e.cjs
// Creates applicants named "<PREFIX> …" through the public form. Use a disposable database, or clean them up afterwards.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const BASE = process.env.BASE;
const PREFIX = process.env.PREFIX || "E2E";
const RUN = Date.now().toString(36).slice(-5);
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, String(e.message).split("\n")[0]]); }
  console.log(results.at(-1).join(" | ")); // progress as each step finishes
};
const IPHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" };
const LINE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/14.20.0";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function login(browser, email, password, opts = { viewport: { width: 1440, height: 900 } }) {
  const ctx = await browser.newContext({ ...opts, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sign-in`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/sign-in")), page.click("button[type=submit]")]);
  return { ctx, page };
}
/** No horizontal overflow on the scrolling element(s) and every text input ≥ 16px (no iOS zoom). */
async function layoutOk(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scrollers = [document.documentElement, document.body, ...document.querySelectorAll(".pf-root, .kol, .content")];
    const overflow = scrollers.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => `${el.className || el.tagName}:${el.scrollWidth}>${el.clientWidth}`);
    const wide = [...document.querySelectorAll(".pf-root *, .kol *")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== "fixed" && !el.closest(".k-table-wrap, .k-subnav, .k-ceo-tabs, .k-chips, .k-social, dialog"); })
      .slice(0, 3).map((el) => `${el.tagName}.${String(el.className).slice(0, 30)} right=${Math.round(el.getBoundingClientRect().right)}`);
    const small = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea")]
      .filter((el) => el.offsetParent !== null && parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => el.id || el.name);
    return { overflow, wide, small };
  });
}

/** The public form refuses submissions sent within 2.5 s of the page render (bot guard); wait like a person would. */
async function humanPace(page) {
  const t = await page.evaluate(() => performance.now());
  if (t < 3200) await page.waitForTimeout(3200 - t);
}
async function applyPublic(browser, o) {
  const ctx = await browser.newContext({ ...IPHONE, ...(o.ua ? { userAgent: o.ua } : {}) });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/f/${o.slug}`);
  await page.getByRole("button", { name: /เริ่มกรอกใบสมัคร/ }).click();
  if (o.checkValidation) {
    await page.locator("#pf-f_full_name").fill(o.name);
    await page.getByRole("button", { name: "ถัดไป" }).click();
    await page.getByText("กรุณากรอกข้อมูลช่องนี้").first().waitFor();
    assert.equal(await page.locator("#pf-f_full_name").inputValue(), o.name, "typed value kept after validation error");
  }
  await page.locator("#pf-f_full_name").fill(o.name);
  await page.locator("#pf-f_creator_name").fill(o.creator);
  await page.locator("#pf-f_phone").fill("081-234-5678");
  await page.locator("#pf-f_line_id").fill(`line_${o.creator}`.slice(0, 40));
  if (o.photo) {
    await page.locator("#pf-f_photo").setInputFiles({ name: "profile.png", mimeType: "image/png", buffer: PNG });
    await page.getByText("อัปโหลดแล้ว").waitFor({ timeout: 15000 });
  }
  if (o.layout) o.layout.push(["public step1", await layoutOk(page)]);
  await page.getByRole("button", { name: "ถัดไป" }).click();
  await page.locator(".pf-choice", { hasText: "Instagram" }).click();
  await page.locator("#pf-f_ig_url").fill(`instagram.com/${o.creator}`);
  await page.locator("#pf-f_ig_followers").fill(o.followers ?? "12.5k");
  assert.equal(await page.locator("#pf-f_tt_url").count(), 0, "TikTok field hidden until TikTok is chosen");
  await page.getByRole("button", { name: "ถัดไป" }).click();
  await page.locator(".pf-choice", { hasText: "Tennis" }).click();
  await page.locator(".pf-choice", { hasText: "Fitness" }).click();
  await page.locator(".pf-choice", { hasText: "ไม่เคยเล่นเทนนิส" }).click();
  await page.locator(".pf-consent", { hasText: "ค่าชั่วโมงโค้ช" }).click(); // conditional field shown for never-played
  await page.locator("#pf-f_review_link").fill("https://www.tiktok.com/@demo/video/1");
  await page.getByRole("button", { name: "ถัดไป" }).click();
  await page.locator(".pf-terms h3").waitFor();
  await page.getByText("เครดิตจองคอร์ทฟรี 10 ชั่วโมง มูลค่า 6,000 บาท").waitFor();
  await page.locator(".pf-consent", { hasText: "รับทราบเงื่อนไข" }).click();
  if (o.layout) o.layout.push(["public terms", await layoutOk(page)]);
  await page.getByRole("button", { name: "ตรวจสอบข้อมูล" }).click();
  await page.getByText("ตรวจสอบข้อมูลก่อนส่ง").waitFor();
  const submit = page.getByRole("button", { name: /ส่งใบสมัคร/ });
  await humanPace(page);
  // double tap: two clicks in the same frame, before React can disable the button
  if (o.doubleTap) await submit.evaluate((b) => { b.click(); b.click(); }); else await submit.click();
  await page.getByText("ส่งใบสมัครเรียบร้อยแล้ว").waitFor({ timeout: 20000 });
  const ref = (await page.locator(".pf-ref b").textContent()).trim();
  const statusUrl = (await page.locator(".pf-statuslink code").textContent()).trim();
  await ctx.close();
  return { ref, statusUrl };
}

async function applicantIdFromList(page, creator) {
  await page.goto(`${BASE}/kol?q=${encodeURIComponent(creator)}`);
  const link = page.locator(".k-item", { hasText: creator }).getByRole("link", { name: /ดูรายละเอียด/ });
  return (await link.getAttribute("href")).split("/").pop();
}
async function sendToCeo(page, id, pitch) {
  await page.goto(`${BASE}/kol/applicants/${id}`);
  const det = page.locator("details", { hasText: "เสนอ CEO พิจารณา" });
  if ((await det.getAttribute("open")) === null) await det.locator("summary").click();
  await page.fill("input[name=short_pitch]", pitch);
  await page.fill("textarea[name=opinion]", "แนวคอนเทนต์ตรงกลุ่ม ผู้ติดตามมีส่วนร่วมดี");
  await page.fill("textarea[name=highlights]", "คลิปสั้นตัดต่อดี");
  await page.fill("textarea[name=cautions]", "ยังไม่เคยเล่นเทนนิส ต้องมีโค้ช");
  await page.getByRole("button", { name: "ส่งการ์ดให้ CEO" }).click();
  await page.getByText("ส่งการ์ดให้ CEO แล้ว").first().waitFor();
}

(async () => {
  const browser = await chromium.launch();
  const owner = await login(browser, process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD);
  const layout = [];
  let slug = "kol-apply";
  const A = { name: `${PREFIX} สมใจ ${RUN}`, creator: `${PREFIX}SJ${RUN}` };
  const B = { name: `${PREFIX} บุญมี ${RUN}`, creator: `${PREFIX}BM${RUN}` };
  const C = { name: `${PREFIX} ชาตรี ${RUN}`, creator: `${PREFIX}CT${RUN}` };
  let refA = "", statusUrlA = "", idA = "", idB = "", idC = "", regUrl = "", vA = 0, vNew = 0;

  await check("setup: /kol creates the KOL campaign + published application form; dashboard shows the public link", async () => {
    await owner.page.goto(`${BASE}/kol`);
    await owner.page.getByText("ลิงก์ฟอร์มสมัคร KOL").waitFor();
    const url = await owner.page.locator("#share-h").locator("xpath=../..").locator(".k-muted").first().textContent();
    slug = url.trim().split("/f/")[1];
    assert.ok(slug, "public slug");
  });

  // ------------------------------------------------------------ Test A — Public Application
  await check("A1 applicant opens the form without login (iPhone), validation keeps values, uploads a photo, submits, gets a reference", async () => {
    const r = await applyPublic(browser, { ...A, slug, photo: true, checkValidation: true, layout });
    refA = r.ref; statusUrlA = r.statusUrl;
    assert.match(refA, /^KOL-\d{4}$/);
    assert.match(statusUrlA, /\/s\/[A-Za-z0-9_-]{43}$/);
  });
  await check("A2 LINE in-app browser: second applicant + double tap creates only one record", async () => {
    await applyPublic(browser, { ...B, slug, ua: LINE_UA, doubleTap: true });
    await owner.page.goto(`${BASE}/kol?q=${encodeURIComponent(B.creator)}`);
    assert.equal(await owner.page.locator(".k-item").count(), 1);
  });
  await check("A3 Marketing sees the applicant immediately; data persists after reload (Database)", async () => {
    await applyPublic(browser, { ...C, slug, followers: "900" });
    const mkt = await login(browser, process.env.MARKETING_EMAIL, process.env.MARKETING_PASSWORD);
    idA = await applicantIdFromList(mkt.page, A.creator);
    idB = await applicantIdFromList(mkt.page, B.creator);
    idC = await applicantIdFromList(mkt.page, C.creator);
    await mkt.page.reload();
    assert.ok(await mkt.page.getByText(C.creator).count());
    await mkt.ctx.close();
  });
  await check("A4 applicant status link shows only their own status (no internal data)", async () => {
    const ctx = await browser.newContext(IPHONE);
    const p = await ctx.newPage();
    await p.goto(statusUrlA);
    await p.getByText("ได้รับใบสมัครแล้ว").waitFor();
    assert.ok((await p.textContent("body")).includes(refA));
    assert.ok(!(await p.textContent("body")).includes(B.creator));
    await p.goto(`${BASE}/s/${"x".repeat(43)}`);
    await p.getByText("ลิงก์นี้ใช้ไม่ได้").waitFor();
    await ctx.close();
  });

  // ------------------------------------------------------------ Test C — Marketing Review + permissions
  const mkt = await login(browser, process.env.MARKETING_EMAIL, process.env.MARKETING_PASSWORD);
  await check("C1 Marketing opens the real applicant: answers, social link, uploaded photo, status history", async () => {
    await mkt.page.goto(`${BASE}/kol/applicants/${idA}`);
    await mkt.page.getByRole("heading", { name: A.creator }).waitFor();
    assert.ok(await mkt.page.getByText("คำตอบฟอร์มทั้งหมด").count());
    vA = Number((await mkt.page.getByText(/^ฟอร์ม v\d+$/).first().textContent()).match(/v(\d+)/)[1]); // version applicant A answered
    assert.ok(await mkt.page.locator(`a[href^="https://instagram.com/${A.creator}"]`).count());
    const img = await mkt.page.locator(".k-av img").first().getAttribute("src");
    const res = await mkt.page.request.get(`${BASE}${img}`);
    assert.equal(res.headers()["content-type"], "image/png");
  });
  await check("C2 internal note is saved and survives reload", async () => {
    await mkt.page.fill("section[aria-labelledby=h-notes] textarea", "โปรไฟล์ดี ติดต่อง่าย");
    await mkt.page.locator("section[aria-labelledby=h-notes] button[type=submit]").click();
    await mkt.page.getByText("บันทึกหมายเหตุแล้ว").waitFor();
    await mkt.page.reload();
    await mkt.page.getByText("โปรไฟล์ดี ติดต่อง่าย").waitFor();
  });
  await check("C3 Shortlist, then Send to CEO creates a real approval request", async () => {
    await mkt.page.getByRole("button", { name: /ผ่านการคัดกรอง \(Shortlist\)/ }).click();
    await mkt.page.getByText("ย้ายเข้ารายชื่อผ่านการคัดกรองแล้ว").first().waitFor();
    await sendToCeo(mkt.page, idA, `เสนอ ${A.creator}`);
    await sendToCeo(mkt.page, idB, `เสนอ ${B.creator}`);
    await sendToCeo(mkt.page, idC, `เสนอ ${C.creator}`);
    await mkt.page.goto(`${BASE}/kol/applicants/${idA}`);
    await mkt.page.getByText("รอ CEO พิจารณา — Marketing").waitFor();
  });
  await check("C3b Marketing copies the CEO card link; a signed-out CEO opens it on iPhone, signs in and lands on that card", async () => {
    await mkt.page.goto(`${BASE}/kol/applicants/${idA}`);
    const box = mkt.page.locator("#ceo-link");
    await box.getByRole("button", { name: "คัดลอกลิงก์" }).click();
    await box.getByText("คัดลอกแล้ว").waitFor();
    const url = await mkt.page.evaluate(() => navigator.clipboard.readText());
    assert.match(url, /\/kol\/ceo\/card\/[0-9a-f-]{36}$/);
    await box.getByRole("button", { name: "คัดลอกข้อความ" }).click();
    const msg = await mkt.page.evaluate(() => navigator.clipboard.readText());
    assert.ok(msg.includes(refA) && msg.includes(url), "message has the reference and the link");
    const cardId = url.split("/").pop();
    const ctx = await browser.newContext(IPHONE);
    const p = await ctx.newPage();
    await p.goto(url); // signed out: sign in first, then back to the card
    await p.waitForURL((u) => u.pathname === "/sign-in" && u.searchParams.get("next") === `/kol/ceo?card=${cardId}`);
    await p.fill("#email", process.env.CEO_EMAIL);
    await p.fill("#password", process.env.CEO_PASSWORD);
    await Promise.all([p.waitForURL((u) => u.pathname === "/kol/ceo" && u.searchParams.get("card") === cardId), p.click("button[type=submit]")]);
    const card = p.locator(".k-ceo", { hasText: A.creator });
    await card.getByRole("button", { name: "Approve" }).waitFor(); // that card, opened, with the decision buttons
    await p.goto(url); // already signed in: straight to the card
    await p.waitForURL((u) => u.pathname === "/kol/ceo" && u.searchParams.get("card") === cardId);
    await ctx.close();
    // a crafted return address to another site is ignored after sign-in
    const x = await browser.newContext();
    const q = await x.newPage();
    await q.goto(`${BASE}/sign-in?next=${encodeURIComponent("//evil.example/kol")}`);
    await q.fill("#email", process.env.CEO_EMAIL);
    await q.fill("#password", process.env.CEO_PASSWORD);
    await Promise.all([q.waitForURL((u) => !u.pathname.startsWith("/sign-in")), q.click("button[type=submit]")]);
    assert.equal(new URL(q.url()).origin, new URL(BASE).origin);
    assert.equal(new URL(q.url()).pathname, "/");
    await x.close();
  });
  await check("C4 Marketing sees the CEO queue but has no decision buttons", async () => {
    await mkt.page.goto(`${BASE}/kol/ceo`);
    const card = mkt.page.locator(".k-ceo", { hasText: A.creator });
    await card.getByRole("button", { name: /ดูรายละเอียด/ }).click();
    assert.equal(await card.getByRole("button", { name: "Approve" }).count(), 0);
  });
  await check("C5 a role without KOL permission cannot open the module or files", async () => {
    if (!process.env.INVENTORY_EMAIL) return;
    const inv = await login(browser, process.env.INVENTORY_EMAIL, process.env.INVENTORY_PASSWORD);
    await inv.page.goto(`${BASE}/kol`);
    await inv.page.getByText("ไม่มีสิทธิ์เข้าถึง KOL").waitFor();
    const r = await inv.page.request.get(`${BASE}/api/kol/files/00000000-0000-4000-8000-000000000000`);
    assert.equal(r.status(), 403);
    await inv.ctx.close();
  });
  await check("C6 signed-out access to back office and files is refused", async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/kol/ceo`);
    assert.match(p.url(), /\/sign-in$/);
    assert.equal((await p.request.get(`${BASE}/api/kol/files/00000000-0000-4000-8000-000000000000`)).status(), 401);
    await ctx.close();
  });

  // ------------------------------------------------------------ Test D — CEO Approval (iPhone)
  const ceo = await login(browser, process.env.CEO_EMAIL, process.env.CEO_PASSWORD, IPHONE);
  const stale = await login(browser, process.env.CEO_EMAIL, process.env.CEO_PASSWORD);
  await check("D1 CEO inbox lists pending cards; expand shows Social profile; comment is saved", async () => {
    await ceo.page.goto(`${BASE}/kol/ceo`);
    const card = ceo.page.locator(".k-ceo", { hasText: A.creator });
    await card.getByText(`เสนอ ${A.creator}`).waitFor();
    await card.getByRole("button", { name: /ดูรายละเอียด/ }).click();
    await card.getByRole("tab", { name: "Social & ผลงาน" }).click();
    assert.ok(await card.locator(`a[href^="https://instagram.com/${A.creator}"]`).count());
    await card.getByRole("tab", { name: /ความคิดเห็น/ }).click();
    await card.locator("textarea").fill("ดีมาก ขอให้นัดช่วงเย็น");
    await card.getByRole("button", { name: "ส่ง" }).click();
    await card.getByText("ดีมาก ขอให้นัดช่วงเย็น").waitFor();
    layout.push(["ceo inbox iPhone", await layoutOk(ceo.page)]);
  });
  await check("D2 Approve updates from the backend result and persists after refresh", async () => {
    await stale.page.goto(`${BASE}/kol/ceo?tab=all`); // second device opens before the decision
    const card = ceo.page.locator(".k-ceo", { hasText: A.creator });
    await card.getByRole("button", { name: "Approve" }).click();
    await card.getByRole("button", { name: "ยืนยันอนุมัติ" }).click();
    await ceo.page.getByText(`อนุมัติ ${A.creator} แล้ว`).waitFor();
    await ceo.page.goto(`${BASE}/kol/ceo?tab=approved`);
    await ceo.page.locator(".k-ceo", { hasText: A.creator }).getByText("อนุมัติแล้ว").first().waitFor();
  });
  await check("D3 no double approval: the stale second device is refused", async () => {
    const card = stale.page.locator(".k-ceo", { hasText: A.creator });
    await card.getByRole("button", { name: /ดูรายละเอียด/ }).click();
    await card.getByRole("button", { name: "Approve" }).click();
    await card.getByRole("button", { name: "ยืนยันอนุมัติ" }).click();
    await card.getByText(/ตัดสินใจไปแล้ว/).waitFor();
  });
  await check("D4 Request More Info requires a reason and moves the card", async () => {
    await ceo.page.goto(`${BASE}/kol/ceo`);
    const card = ceo.page.locator(".k-ceo", { hasText: B.creator });
    await card.getByRole("button", { name: /ดูรายละเอียด/ }).click();
    await card.getByRole("button", { name: "ขอข้อมูลเพิ่ม" }).click();
    await card.locator("textarea[name=note]").fill("ขอลิงก์คลิปรีวิวสถานที่ 1 ลิงก์");
    await card.getByRole("button", { name: "ส่งคำขอข้อมูล" }).click();
    await ceo.page.getByText(`ส่งคำขอข้อมูลเพิ่มของ ${B.creator}`).waitFor();
  });
  await check("D5 Reject asks for confirmation (in-app dialog) and records the reason", async () => {
    const card = ceo.page.locator(".k-ceo", { hasText: C.creator });
    await card.getByRole("button", { name: /ดูรายละเอียด/ }).click();
    await card.getByRole("button", { name: "Reject" }).click();
    await card.locator("textarea[name=note]").fill("ผู้ติดตามต่ำกว่าเกณฑ์");
    await card.getByRole("button", { name: "ไม่อนุมัติ" }).click();
    await ceo.page.getByRole("button", { name: "ยืนยันไม่อนุมัติ" }).click();
    await ceo.page.getByText(`บันทึกไม่อนุมัติ ${C.creator}`).waitFor();
  });
  await check("D6 statuses agree on every page (Marketing dashboard + applicant page)", async () => {
    await mkt.page.goto(`${BASE}/kol?bucket=awaiting_step2`);
    await mkt.page.locator(".k-item", { hasText: A.creator }).first().waitFor();
    await mkt.page.goto(`${BASE}/kol?bucket=rejected`);
    await mkt.page.locator(".k-item", { hasText: C.creator }).first().waitFor();
    await mkt.page.goto(`${BASE}/kol/applicants/${idB}`);
    await mkt.page.getByText("CEO ขอข้อมูลเพิ่ม:").waitFor();
  });

  // ------------------------------------------------------------ Test E — STEP 2
  await check("E1 a not-approved applicant has no STEP 2 link; random tokens are refused", async () => {
    await mkt.page.goto(`${BASE}/kol/applicants/${idB}`);
    assert.ok(await mkt.page.getByText("สร้างได้หลัง CEO อนุมัติ").count());
    const ctx = await browser.newContext(IPHONE);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/r/${"A".repeat(43)}`);
    await p.getByText("ลิงก์นี้ใช้ไม่ได้").waitFor();
    await ctx.close();
  });
  await check("E2 Marketing copies the auto-created STEP 2 link + LINE message", async () => {
    await mkt.page.goto(`${BASE}/kol/applicants/${idA}`);
    await mkt.page.getByRole("button", { name: "คัดลอกข้อความส่ง LINE" }).click();
    await mkt.page.getByText("คัดลอกข้อความแล้ว").waitFor();
    const msg = await mkt.page.evaluate(() => navigator.clipboard.readText());
    regUrl = msg.match(/https?:\/\/\S+\/r\/[A-Za-z0-9_-]{43}/)[0];
    assert.match(msg, /ใช้ได้ถึง/);
  });
  await check("E3 approved KOL opens the private link (iPhone), STEP 1 data is prefilled, submits STEP 2", async () => {
    const ctx = await browser.newContext(IPHONE);
    const p = await ctx.newPage();
    await p.goto(regUrl);
    await p.getByText(`สวัสดีคุณ${A.creator}`).waitFor();
    await p.getByRole("button", { name: /เริ่มกรอกข้อมูล/ }).click();
    await p.locator(".pf-consent", { hasText: "รับทราบเงื่อนไข" }).click();
    await p.getByRole("button", { name: "ถัดไป" }).click();
    assert.equal(await p.locator("#pf-f_full_name").inputValue(), A.name);
    assert.equal(await p.locator("#pf-f_phone").inputValue(), "081-234-5678");
    await p.getByRole("button", { name: "ถัดไป" }).click();
    assert.equal(await p.locator("#pf-f_ig_url").inputValue(), `https://instagram.com/${A.creator}`);
    await p.locator("#pf-f_tt_url").fill(`tiktok.com/@${A.creator}`);
    await p.locator("#pf-f_tt_followers").fill("3400");
    await p.locator("#pf-f_fb_url").fill(`facebook.com/${A.creator}`);
    await p.locator("#pf-f_fb_followers").fill("800");
    await p.getByRole("button", { name: "ถัดไป" }).click();
    await p.locator("#pf-f_comp_card").setInputFiles({ name: "comp.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%test\n") });
    await p.getByText("อัปโหลดแล้ว").waitFor({ timeout: 15000 });
    await p.getByRole("button", { name: "ถัดไป" }).click();
    assert.equal(await p.locator("#pf-f_visit_date").getAttribute("type"), "date");
    assert.equal(await p.locator("#pf-f_visit_time").getAttribute("type"), "time");
    const d = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    await p.locator("#pf-f_visit_date").fill(d);
    await p.locator("#pf-f_visit_time").fill("18:30");
    await p.locator(".pf-choice", { hasText: "ต้องการ (ชำระค่าโค้ชเอง)" }).click();
    layout.push(["step2 visit", await layoutOk(p)]);
    await p.getByRole("button", { name: "ถัดไป" }).click();
    await p.locator(".pf-choice", { hasText: "สมัครแล้ว" }).click();
    await p.locator("#pf-f_member_name").fill(`MEM${RUN}`);
    await p.getByRole("button", { name: "ถัดไป" }).click();
    for (const t of ["รับทราบและสามารถปฏิบัติตามเงื่อนไขได้", "ดำเนินการเรียบร้อย", "รับทราบ หากสงสัย"]) await p.locator(".pf-consent", { hasText: t }).click();
    await p.getByRole("button", { name: "ตรวจสอบข้อมูล" }).click();
    await p.getByRole("button", { name: /ยืนยันข้อมูล/ }).click();
    await p.getByText("ยืนยันข้อมูลเรียบร้อยแล้ว").waitFor({ timeout: 20000 });
    // submitting again (edit) keeps the same person and the same campaign record
    await p.goto(regUrl);
    await p.getByText(/ส่งข้อมูลแล้ว/).waitFor();
    await ctx.close();
  });
  await check("E4 data appears in Campaign Management once (no duplicate applicant/participant)", async () => {
    await mkt.page.goto(`${BASE}/kol/campaign`);
    assert.equal(await mkt.page.locator(".k-item", { hasText: A.creator }).count(), 1);
    await mkt.page.goto(`${BASE}/kol?q=${encodeURIComponent(A.creator)}`);
    assert.equal(await mkt.page.locator(".k-item").count(), 1);
    await mkt.page.goto(`${BASE}/kol?bucket=registered&q=${encodeURIComponent(A.creator)}`);
    assert.equal(await mkt.page.locator(".k-item").count(), 1);
  });

  // ------------------------------------------------------------ Campaign tracking
  await check("E5 campaign: visit confirmed, deliverable submitted with real URL, credit usage, promo code", async () => {
    await mkt.page.goto(`${BASE}/kol/campaign`);
    await mkt.page.locator(".k-item", { hasText: A.creator }).getByRole("link", { name: /จัดการ/ }).click();
    await mkt.page.getByText("Deliverables (0/4 ตรวจแล้ว)").waitFor();
    await mkt.page.selectOption("select[name=visit_status]", "confirmed");
    await mkt.page.locator("section[aria-labelledby=h-visit] button[type=submit]").click();
    await mkt.page.getByText("บันทึกการนัดหมายแล้ว").waitFor();
    const reels = mkt.page.locator(".k-deliv", { hasText: "IG Reels 1 คลิป" });
    await reels.locator("select[name=status]").selectOption("submitted");
    await reels.locator("input[name=url]").fill("https://www.instagram.com/reel/abc123");
    await reels.locator("input[name=views]").fill("5400");
    await reels.getByRole("button", { name: "บันทึก" }).click();
    await reels.getByText("บันทึกผลงานแล้ว").waitFor();
    await mkt.page.locator("details", { hasText: "บันทึกการใช้เครดิต" }).locator("summary").click();
    await mkt.page.fill("input[name=hours]", "2");
    await mkt.page.getByRole("button", { name: "บันทึก (ติดตามภายใน)" }).click();
    await mkt.page.getByText("บันทึกเครดิต (ติดตามภายใน) แล้ว").waitFor();
    await mkt.page.reload();
    assert.ok(await mkt.page.getByText("ข้อมูลติดตามภายใน — ยังไม่ได้เชื่อมระบบจองสนาม").count());
    assert.equal((await mkt.page.locator(".k-stats .k-stat b").nth(2).textContent()).trim(), "8");
    await mkt.page.getByRole("button", { name: "บันทึกโค้ด" }).click();
    await mkt.page.getByText(/บันทึกโค้ด .* แล้ว/).waitFor();
    assert.ok(await mkt.page.getByText("ยังไม่เชื่อมกับข้อมูลระบบจอง").count());
  });

  // ------------------------------------------------------------ Test B — Form Builder + versioning
  await check("B1 Form Builder: add, rename, require, condition, reorder a question, publish a new version", async () => {
    const p = mkt.page;
    await p.goto(`${BASE}/kol/forms`);
    await p.locator(".k-form-card", { hasText: "สมัคร KOL / Influencers" }).getByRole("link", { name: "Edit" }).click();
    await p.waitForURL(/\/edit$/);
    const discard = p.getByRole("button", { name: "ยกเลิกการแก้ไข" });
    if (await discard.count()) { // leftover unpublished draft from an interrupted run: start from the published version
      await discard.click();
      await p.locator("dialog[open]").getByRole("button", { name: "ยกเลิกการแก้ไข" }).click();
      await p.waitForLoadState("load");
      await discard.waitFor({ state: "detached" });
    }
    const sec = p.locator(".fe-sec").nth(2);
    await sec.getByRole("button", { name: "เพิ่มคำถาม" }).click();
    await sec.getByRole("menuitem", { name: "ข้อความสั้น" }).click();
    const field = sec.locator(".fe-field").last();
    await field.locator("input").first().fill(`E2E คำถามใหม่ ${RUN}`);
    await field.getByText("บังคับตอบ (Required)").click();
    await field.getByText("Conditional Logic").click();
    await field.getByRole("button", { name: "ตั้งเงื่อนไขการแสดง" }).click();
    await field.locator(".fe-cond select").first().selectOption({ label: "ประสบการณ์การเล่นเทนนิส" });
    await field.locator(".fe-cond select").nth(2).selectOption({ label: "เล่นเป็นประจำ" });
    await field.getByRole("button", { name: "ย้ายคำถามขึ้น" }).click();
    await p.getByText("บันทึกร่างแล้ว").waitFor({ timeout: 10000 });
    await p.getByRole("button", { name: /Publish/ }).click();
    const msg = p.getByText(/เผยแพร่เวอร์ชัน \d+ แล้ว/);
    await msg.waitFor({ timeout: 15000 });
    vNew = Number((await msg.textContent()).match(/เวอร์ชัน (\d+)/)[1]);
    assert.ok(vNew > vA, `new version ${vNew} is after the one applicant A used (${vA})`);
  });
  await check("B2 public form shows the new question only under its condition; old answers still read their own version", async () => {
    const ctx = await browser.newContext(IPHONE);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/f/${slug}`);
    await p.getByRole("button", { name: /เริ่มกรอกใบสมัคร/ }).click();
    await p.locator("#pf-f_full_name").fill("x"); await p.locator("#pf-f_creator_name").fill("x");
    await p.locator("#pf-f_phone").fill("0812345678"); await p.locator("#pf-f_line_id").fill("x");
    await p.getByRole("button", { name: "ถัดไป" }).click();
    await p.locator(".pf-choice", { hasText: "TikTok" }).click();
    await p.locator("#pf-f_tt_url").fill("tiktok.com/@x"); await p.locator("#pf-f_tt_followers").fill("10");
    await p.getByRole("button", { name: "ถัดไป" }).click();
    assert.equal(await p.getByText(`E2E คำถามใหม่ ${RUN}`).count(), 0);
    await p.locator(".pf-choice", { hasText: "เล่นเป็นประจำ" }).click();
    await p.getByText(`E2E คำถามใหม่ ${RUN}`).waitFor();
    await ctx.close();
    await mkt.page.goto(`${BASE}/kol/applicants/${idA}`);
    await mkt.page.getByText(`ฟอร์ม v${vA}`).waitFor();
  });
  await check("B3 workflow-critical mapping is protected; deleting the question and publishing again keeps old answers", async () => {
    const p = mkt.page;
    await p.goto(`${BASE}/kol/forms`);
    await p.locator(".k-form-card", { hasText: "สมัคร KOL / Influencers" }).getByRole("link", { name: "Edit" }).click();
    const f = p.locator(".fe-field", { hasText: `E2E คำถามใหม่ ${RUN}` });
    await f.getByRole("button", { name: "แก้ไขคำถาม" }).click();
    await f.getByRole("button", { name: "ลบคำถาม" }).click();
    await p.locator("dialog[open]").getByRole("button", { name: "ลบคำถาม" }).click();
    // try removing the phone question (mapped to applicant.phone): publish must be blocked
    const phone = p.locator(".fe-field", { hasText: "เบอร์โทรศัพท์" }).first();
    await phone.getByRole("button", { name: "แก้ไขคำถาม" }).click();
    await phone.getByRole("button", { name: "ลบคำถาม" }).click();
    await p.locator("dialog[open]").getByText(/ผูกกับ “เบอร์โทรศัพท์”/).waitFor();
    await p.locator("dialog[open]").getByRole("button", { name: "ลบคำถาม" }).click();
    await p.getByRole("button", { name: /Publish/ }).click();
    await p.getByText(/ต้องมีคำถามที่ผูกกับ “เบอร์โทรศัพท์”/).waitFor({ timeout: 15000 });
    // undo the unpublished edits
    await p.getByRole("button", { name: "ยกเลิกการแก้ไข" }).click();
    await p.locator("dialog[open]").getByRole("button", { name: "ยกเลิกการแก้ไข" }).click();
    await p.waitForLoadState("load");
    await p.locator(".fe-field", { hasText: "เบอร์โทรศัพท์" }).first().waitFor();
    // now really remove the test question and publish the next version
    const q = p.locator(".fe-field", { hasText: `E2E คำถามใหม่ ${RUN}` });
    await q.getByRole("button", { name: "แก้ไขคำถาม" }).click();
    await q.getByRole("button", { name: "ลบคำถาม" }).click();
    await p.locator("dialog[open]").getByRole("button", { name: "ลบคำถาม" }).click();
    await p.getByText("บันทึกร่างแล้ว").waitFor({ timeout: 10000 });
    await p.getByRole("button", { name: /Publish/ }).click();
    await p.getByText(`เผยแพร่เวอร์ชัน ${vNew + 1} แล้ว`).waitFor({ timeout: 15000 });
    await p.goto(`${BASE}/f/${slug}`);
    assert.equal(await p.getByText(`E2E คำถามใหม่ ${RUN}`).count(), 0, "deleted question is gone from the live form");
    await p.goto(`${BASE}/kol/applicants/${idA}`);
    await p.getByText(`ฟอร์ม v${vA}`).waitFor();
  });
  await check("B4 responses list + CSV and Excel export with all versions", async () => {
    const p = mkt.page;
    await p.goto(`${BASE}/kol/forms`);
    await p.locator(".k-form-card", { hasText: "สมัคร KOL / Influencers" }).getByRole("link", { name: "View Responses" }).click();
    await p.getByText(refA, { exact: true }).first().waitFor();
    const href = await p.getByRole("link", { name: "Export CSV" }).getAttribute("href");
    const csv = await p.request.get(`${BASE}${href}`);
    const text = await csv.text();
    assert.match(csv.headers()["content-type"], /text\/csv/);
    assert.ok(text.includes(refA) && text.includes("ชื่อ–นามสกุล"));
    const x = await p.request.get(`${BASE}${(await p.getByRole("link", { name: "Export Excel" }).getAttribute("href"))}`);
    assert.match(x.headers()["content-type"], /spreadsheetml/);
  });
  await check("B5 Preview Mobile / Desktop render the real form without saving", async () => {
    const p = mkt.page;
    await p.goto(`${BASE}/kol/forms`);
    await p.locator(".k-form-card", { hasText: "สมัคร KOL / Influencers" }).getByRole("link", { name: "Preview" }).click();
    await p.getByText("ตัวอย่างฟอร์ม — กดส่งได้แต่ไม่บันทึกข้อมูล").waitFor();
    await p.getByRole("link", { name: "Desktop" }).click();
    await p.locator(".pv-frame[data-device=desktop]").waitFor();
  });

  // ------------------------------------------------------------ Test F — Mobile layout
  await check("F1 no horizontal overflow and no input zoom (375 / 390 / 430 px; public + back office)", async () => {
    for (const w of [375, 390, 430]) {
      const ctx = await browser.newContext({ ...IPHONE, viewport: { width: w, height: 800 } });
      const p = await ctx.newPage();
      await p.goto(`${BASE}/f/${slug}`);
      layout.push([`public landing ${w}`, await layoutOk(p)]);
      await ctx.close();
      const m = await login(browser, process.env.MARKETING_EMAIL, process.env.MARKETING_PASSWORD, { ...IPHONE, viewport: { width: w, height: 800 } });
      for (const path of ["/kol", `/kol/applicants/${idA}`, "/kol/ceo?tab=all", "/kol/campaign", "/kol/forms"]) {
        await m.page.goto(`${BASE}${path}`);
        layout.push([`${path} ${w}`, await layoutOk(m.page)]);
      }
      await m.ctx.close();
    }
    const bad = layout.filter(([, r]) => r.overflow.length || r.wide.length || r.small.length);
    assert.equal(bad.length, 0, bad.map(([n, r]) => `${n}: ${JSON.stringify(r)}`).join(" ; "));
  });

  await browser.close();
  const failed = results.filter((r) => r[0] === "FAIL").length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
