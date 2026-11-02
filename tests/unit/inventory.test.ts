import { test } from "node:test";
import assert from "node:assert/strict";
import { signedDelta, normalizeLine, normalizePhone, bahtToSatang, StockError } from "../../lib/inventory-core.ts";

test("movement signs follow type; zero / fractional / negative rejected", () => {
  assert.equal(signedDelta("RECEIVE", 24), 24);
  assert.equal(signedDelta("SALE", 3), -3);
  assert.equal(signedDelta("TRANSFER_OUT", 12), -12);
  assert.equal(signedDelta("ADJUST", -2), -2);
  assert.throws(() => signedDelta("RECEIVE", 0), StockError);
  assert.throws(() => signedDelta("SALE", 1.5), StockError);
  assert.throws(() => signedDelta("SALE", -1), StockError);
});

test("LINE contact normalization", () => {
  assert.equal(normalizeLine("https://lin.ee/abc123"), "https://lin.ee/abc123");
  assert.equal(normalizeLine("@wondershop"), "https://line.me/R/ti/p/%40wondershop");
  assert.equal(normalizeLine("somchai.k"), "https://line.me/R/ti/p/~somchai.k");
  assert.equal(normalizeLine("  "), null);
  assert.throws(() => normalizeLine("javascript:alert(1)"), StockError);
  assert.throws(() => normalizeLine("https://evil.example/line.me/"), StockError);
});

test("phone and money parsing", () => {
  assert.equal(normalizePhone("081-234-5678"), "0812345678");
  assert.equal(normalizePhone("+66 81 234 5678"), "+66812345678");
  assert.throws(() => normalizePhone("abc"), StockError);
  assert.equal(bahtToSatang("1,234.5"), 123450);
  assert.equal(bahtToSatang("฿15"), 1500);
  assert.equal(bahtToSatang(""), null);
  assert.throws(() => bahtToSatang("1.234"), StockError);
});

import { parseCsv, parseUpload, validateRows, templateWorkbook } from "../../lib/inventory-import.ts";

test("CSV parser handles BOM, quotes, commas and CRLF", () => {
  const g = parseCsv('﻿sku,name\r\n"A-1","น้ำ, เย็น ""พิเศษ"""\r\n\r\nB-2,ลูกเทนนิส\n');
  assert.deepEqual(g, [["sku", "name"], ["A-1", 'น้ำ, เย็น "พิเศษ"'], ["B-2", "ลูกเทนนิส"]]);
});

test("import validation: required fields, duplicates, numbers, money", () => {
  const rows = validateRows([
    { sku: "W-1", name: "น้ำ", cost: "5.50", receiveQty: "48", packSize: "12" },
    { sku: "W-1", name: "น้ำซ้ำ" },
    { sku: "bad sku!", name: "" },
    { sku: "X-1", name: "x", receiveQty: "1.5", cost: "1.234" },
  ]);
  assert.deepEqual(rows[0].errors, []);
  assert.equal(rows[0].data.costSatang, 550);
  assert.equal(rows[0].data.receiveQty, 48);
  assert.match(rows[1].errors.join(), /ซ้ำกับแถว 2/);
  assert.equal(rows[2].errors.length, 2);
  assert.equal(rows[3].errors.length, 2);
});

test("template round-trips through the xlsx parser with Thai headers", async () => {
  const buf = await templateWorkbook();
  const raw = await parseUpload("template.xlsx", buf);
  assert.equal(raw.length, 2);
  assert.equal(raw[0].sku, "WATER-600");
  const v = validateRows(raw);
  assert.deepEqual(v.map((r) => r.errors.length), [0, 0]);
  assert.equal(v[0].data.costSatang, 550);
  assert.equal(v[1].data.location, "คลังสินค้า");
});
