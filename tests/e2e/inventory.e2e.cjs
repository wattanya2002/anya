// Inventory end-to-end (S17–S24). usage: BASE=... OWNER_EMAIL=... OWNER_PASSWORD=... [MARKETING_EMAIL/PASSWORD] node tests/e2e/inventory.e2e.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const BASE = process.env.BASE;
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e.message.split("\n")[0]]); } };
const T = Date.now().toString(36).toUpperCase();

async function login(b, email, pw) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/sign-in`); await p.fill("#email", email); await p.fill("#password", pw);
  await Promise.all([p.waitForURL(`${BASE}/`), p.click("button[type=submit]")]);
  return { ctx, p };
}
const okMsg = async (p) => { await p.locator(".form-msg.ok, .form-msg.err").first().waitFor({ timeout: 10000 }); const err = await p.locator(".form-msg.err").count(); if (err) throw new Error(await p.locator(".form-msg.err").first().innerText()); };
async function stockOp(p, op, product, loc, qty, extra = {}) {
  await p.goto(`${BASE}/inventory/movements`);
  await p.selectOption("#mv-op", op);
  await p.selectOption("#mv-product", { label: product });
  await p.selectOption("#mv-loc", { label: loc });
  if (extra.to) await p.selectOption("#mv-to", { label: extra.to });
  await p.fill("#mv-qty", String(qty));
  await p.click("form.form-grid button[type=submit]");
}
const rowText = async (p, sku) => (await p.locator("tr", { hasText: sku }).first().innerText()).replace(/\s+/g, " ");

(async () => {
  const b = await chromium.launch();
  const { ctx, p } = await login(b, process.env.OWNER_EMAIL, process.env.OWNER_PASSWORD);
  const sup = `ซัพทดสอบ ${T}`, sku = `E2E-${T}`, name = `น้ำทดสอบ ${T}`;

  await check("add supplier with phone + LINE ID → tap shortcuts render", async () => {
    await p.goto(`${BASE}/inventory/suppliers?new=1`);
    await p.fill("#s-name", sup); await p.fill("#s-phone", "081-111-2222"); await p.fill("#s-line", "@e2eshop"); await p.fill("#s-lead", "3");
    await p.click("form.form-grid button[type=submit]"); await okMsg(p);
    await p.goto(`${BASE}/inventory/suppliers`);
    const row = p.locator("li.row", { hasText: sup });
    assert.equal(await row.locator("a.contact-btn.tel").getAttribute("href"), "tel:0811112222");
    assert.equal(await row.locator("a.contact-btn.line").getAttribute("href"), "https://line.me/R/ti/p/%40e2eshop");
  });

  await check("invalid LINE value is rejected with a Thai message", async () => {
    await p.goto(`${BASE}/inventory/suppliers?new=1`);
    await p.fill("#s-name", `x ${T}`); await p.fill("#s-line", "javascript:alert(1)");
    await p.click("form.form-grid button[type=submit]");
    await p.locator(".form-msg.err").waitFor(); assert.match(await p.locator(".form-msg.err").innerText(), /LINE/);
    assert.equal(await p.inputValue("#s-name"), `x ${T}`, "entered values kept");
  });

  await check("add product (new category/brand, supplier, opening 24 in warehouse)", async () => {
    await p.goto(`${BASE}/inventory/products?new=1`);
    await p.fill("#p-name", name); await p.fill("#p-sku", sku); await p.fill("#p-cat", `เครื่องดื่มทดสอบ ${T}`); await p.fill("#p-brand", `แบรนด์ ${T}`);
    await p.fill("#p-unit", "ขวด"); await p.fill("#p-pack", "12"); await p.fill("#p-cost", "5.50"); await p.fill("#p-rp", "10"); await p.fill("#p-rq", "24");
    await p.selectOption("#p-sup", { label: sup }); await p.fill("#p-open", "24");
    await p.click("form.form-grid button[type=submit]"); await okMsg(p);
    await p.goto(`${BASE}/inventory/products?q=${sku}`);
    assert.match(await rowText(p, sku), /24 0 24 ขวด ปกติ ฿5.50/);
  });

  await check("duplicate SKU is rejected", async () => {
    await p.goto(`${BASE}/inventory/products?new=1`);
    await p.fill("#p-name", "ซ้ำ"); await p.fill("#p-sku", sku.toLowerCase());
    await p.click("form.form-grid button[type=submit]");
    await p.locator(".form-msg.err").waitFor(); assert.match(await p.locator(".form-msg.err").innerText(), /SKU/);
  });

  await check("transfer 12 to cabinet is not a sale; sell 3 → cabinet 9, total 21", async () => {
    await stockOp(p, "TRANSFER", `${name} · ${sku}`, "คลังสินค้า", 12, { to: "ตู้ขายน้ำ" }); await okMsg(p);
    await p.goto(`${BASE}/inventory/products?q=${sku}`); assert.match(await rowText(p, sku), /12 12 24 ขวด/);
    await stockOp(p, "SALE", `${name} · ${sku}`, "ตู้ขายน้ำ", 3); await okMsg(p);
    await p.goto(`${BASE}/inventory/products?q=${sku}`); assert.match(await rowText(p, sku), /12 9 21 ขวด/);
  });

  await check("overselling is blocked and nothing changes", async () => {
    await stockOp(p, "SALE", `${name} · ${sku}`, "ตู้ขายน้ำ", 50);
    await p.locator(".form-msg.err").waitFor(); assert.match(await p.locator(".form-msg.err").innerText(), /สต็อกไม่พอ/);
    await p.goto(`${BASE}/inventory/products?q=${sku}`); assert.match(await rowText(p, sku), /12 9 21 ขวด/);
  });

  await check("count adjustment to 4 in warehouse → low-stock appears with supplier contact on overview", async () => {
    await stockOp(p, "COUNT", `${name} · ${sku}`, "คลังสินค้า", 4); await okMsg(p);
    await p.goto(`${BASE}/inventory/products?q=${sku}`); assert.match(await rowText(p, sku), /4 9 13 ขวด ปกติ|4 9 13 ขวด ใกล้หมด/);
    await stockOp(p, "ISSUE", `${name} · ${sku}`, "ตู้ขายน้ำ", 4); await okMsg(p); // total 9 ≤ 10 → low
    await p.goto(`${BASE}/inventory`);
    const item = p.locator(".inv-att li.row", { hasText: name });
    assert.match(await item.innerText(), /ใกล้หมด/);
    assert.match(await item.innerText(), /แนะนำสั่ง 24/);
    assert.equal(await item.locator("a.contact-btn.tel").count(), 1);
  });

  await check("movement log records actor and resulting balance", async () => {
    await p.goto(`${BASE}/inventory/movements`);
    const t = await p.locator("tbody tr", { hasText: sku }).first().innerText();
    assert.match(t, /เบิกใช้/); assert.match(t, /5/); // balance after ISSUE 4 from cabinet 9 → 5
  });

  await check("manager report: text includes the item, LINE share link, Excel export downloads", async () => {
    await p.goto(`${BASE}/inventory/report?preset=7`);
    const txt = await p.locator(".report-pre").innerText();
    assert.match(txt, new RegExp(name)); assert.match(txt, /ต้องสั่งเพิ่ม/);
    assert.match(await p.locator("a.btn-pill.line").getAttribute("href"), /^https:\/\/line\.me\/R\/share\?text=/);
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("a:has-text('ดาวน์โหลด Excel')")]);
    const f = await dl.path(); const head = fs.readFileSync(f).subarray(0, 2).toString();
    assert.equal(head, "PK", "xlsx is a zip");
  });

  await check("import: template downloads; CSV upload → preview with errors → confirm creates products + receives stock", async () => {
    await p.goto(`${BASE}/inventory/import`);
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("a:has-text('ดาวน์โหลดไฟล์แม่แบบ')")]);
    assert.equal(fs.readFileSync(await dl.path()).subarray(0, 2).toString(), "PK");
    const csv = `﻿รหัสสินค้า (SKU)*,ชื่อสินค้า*,ประเภท,ยี่ห้อ/แบรนด์,จำนวนรับเข้า,ที่เก็บ,ซัพพลายเออร์\nIMP-${T},"ลูกเทนนิส, ทดสอบ",อุปกรณ์ ${T},Pro ${T},6,ตู้ขายน้ำ,${sup}\n,ไม่มีSKU,,,,,\n`;
    const file = path.join(os.tmpdir(), `import-${T}.csv`); fs.writeFileSync(file, csv);
    await p.setInputFiles("#imp-file", file);
    await Promise.all([p.waitForURL(/job=/), p.click("form.form-grid button[type=submit]")]);
    assert.match(await p.locator("main").innerText(), /ถูกต้อง 1 · มีข้อผิดพลาด 1/);
    await p.click("button:has-text('ยืนยันนำเข้า 1 แถว')");
    await p.locator(".form-msg.ok", { hasText: "เพิ่มใหม่ 1" }).waitFor({ timeout: 15000 });
    await p.goto(`${BASE}/inventory/products?q=IMP-${T}`); assert.match(await rowText(p, `IMP-${T}`), /0 6 6/);
    await p.goBack(); await p.goBack();
  });

  await check("confirming the same import twice does not duplicate stock", async () => {
    await p.goto(`${BASE}/inventory/import`);
    await p.locator("li.row a.row-title").first().click();
    assert.equal(await p.locator("button:has-text('ยืนยันนำเข้า')").count(), 0, "confirm button hidden after completion");
    await p.goto(`${BASE}/inventory/products?q=IMP-${T}`); assert.match(await rowText(p, `IMP-${T}`), /0 6 6/);
  });

  if (process.env.MARKETING_EMAIL) {
    await check("marketing role cannot open Inventory", async () => {
      const m = await login(b, process.env.MARKETING_EMAIL, process.env.MARKETING_PASSWORD);
      await m.p.goto(`${BASE}/inventory/products`);
      assert.match(await m.p.locator("main").innerText(), /ไม่มีสิทธิ์เข้าถึง Inventory/);
      const r = await m.p.request.get(`${BASE}/inventory/report/export`);
      assert.equal(r.status(), 401);
      await m.ctx.close();
    });
  }
  await ctx.close(); await b.close();
  for (const r of results) console.log(r.join(" | "));
  const failed = results.filter((r) => r[0] === "FAIL").length;
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
