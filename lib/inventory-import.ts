/** Product import: parse .xlsx / .csv, map Thai or English headers, validate each row. */
import ExcelJS from "exceljs";
import { StockError, bahtToSatang } from "./inventory-core.ts";

export type ImportRow = {
  sku: string; name: string; category: string | null; brand: string | null; unit: string | null; packSize: number | null;
  costSatang: number | null; priceSatang: number | null; reorderPoint: number | null; reorderQty: number | null;
  supplier: string | null; barcode: string | null; location: string | null; receiveQty: number | null; note: string | null;
};
export type ValidatedRow = { rowNo: number; data: ImportRow; errors: string[] };

/** Column order of the template (Thai headers). */
export const TEMPLATE_COLUMNS = [
  ["sku", "รหัสสินค้า (SKU)*"], ["name", "ชื่อสินค้า*"], ["category", "ประเภท"], ["brand", "ยี่ห้อ/แบรนด์"],
  ["unit", "หน่วย"], ["packSize", "จำนวนต่อแพ็ก"], ["cost", "ราคาทุน (บาท)"], ["price", "ราคาขาย (บาท)"],
  ["reorderPoint", "จุดสั่งซื้อ"], ["reorderQty", "จำนวนสั่งต่อครั้ง"], ["supplier", "ซัพพลายเออร์"],
  ["barcode", "บาร์โค้ด"], ["location", "ที่เก็บ"], ["receiveQty", "จำนวนรับเข้า"], ["note", "หมายเหตุ"],
] as const;

const ALIASES: Record<string, string[]> = {
  sku: ["sku", "รหัสสินค้า", "รหัส"], name: ["name", "ชื่อสินค้า", "สินค้า", "ชื่อ"], category: ["category", "ประเภท", "หมวด", "หมวดหมู่"],
  brand: ["brand", "ยี่ห้อ", "แบรนด์", "ยี่ห้อ/แบรนด์"], unit: ["unit", "หน่วย"], packSize: ["pack", "packsize", "pack size", "จำนวนต่อแพ็ก", "แพ็ก"],
  cost: ["cost", "ราคาทุน", "ต้นทุน"], price: ["price", "ราคาขาย"], reorderPoint: ["reorder point", "reorderpoint", "จุดสั่งซื้อ", "ขั้นต่ำ"],
  reorderQty: ["reorder qty", "reorderqty", "จำนวนสั่งต่อครั้ง", "จำนวนสั่ง"], supplier: ["supplier", "ซัพพลายเออร์", "ผู้ขาย"],
  barcode: ["barcode", "บาร์โค้ด"], location: ["location", "ที่เก็บ", "คลัง"], receiveQty: ["receive", "qty", "จำนวนรับเข้า", "รับเข้า", "จำนวน"],
  note: ["note", "หมายเหตุ"],
};

function keyFor(header: string): string | null {
  const h = header.toLowerCase().replace(/\(.*?\)|\*/g, "").trim();
  for (const [key, names] of Object.entries(ALIASES)) if (names.some((n) => n === h)) return key;
  return null;
}

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF), strips a UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) out.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) out.push(row);
  return out;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v) return v.result === undefined || v.result === null ? "" : String(v.result);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v);
}

export async function parseUpload(fileName: string, buf: Buffer): Promise<Record<string, string>[]> {
  let grid: string[][];
  if (/\.csv$/i.test(fileName)) grid = parseCsv(buf.toString("utf8"));
  else if (/\.xlsx$/i.test(fileName)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    grid = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      const vals = r.values as ExcelJS.CellValue[];
      grid.push(vals.slice(1).map(cellText));
    });
  } else throw new StockError("INVALID", "รองรับเฉพาะไฟล์ .xlsx หรือ .csv");
  if (grid.length < 2) return [];
  const keys = grid[0].map((h) => keyFor(String(h)));
  if (!keys.includes("sku") || !keys.includes("name")) throw new StockError("INVALID", "ไม่พบคอลัมน์ “รหัสสินค้า (SKU)” และ “ชื่อสินค้า” ในแถวแรก");
  return grid.slice(1).map((cells) => {
    const o: Record<string, string> = {};
    keys.forEach((k, i) => { if (k) o[k] = String(cells[i] ?? "").trim(); });
    return o;
  }).filter((o) => Object.values(o).some((v) => v !== ""));
}

const intField = (v: string | undefined, label: string, errors: string[], min = 0): number | null => {
  if (!v) return null;
  const n = Number(v.replace(/,/g, ""));
  if (!Number.isInteger(n) || n < min) { errors.push(`${label} ต้องเป็นจำนวนเต็ม ≥ ${min}`); return null; }
  return n;
};

export function validateRows(raw: Record<string, string>[]): ValidatedRow[] {
  const seen = new Map<string, number>();
  return raw.map((r, i) => {
    const rowNo = i + 2; // header is row 1
    const errors: string[] = [];
    const sku = (r.sku ?? "").trim();
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(sku)) errors.push("SKU ว่างหรือมีอักขระที่ไม่รองรับ (A-Z 0-9 . _ -)");
    const dup = seen.get(sku.toLowerCase());
    if (sku && dup) errors.push(`SKU ซ้ำกับแถว ${dup}`);
    if (sku) seen.set(sku.toLowerCase(), rowNo);
    const name = (r.name ?? "").trim();
    if (!name) errors.push("ไม่มีชื่อสินค้า");
    if (name.length > 160) errors.push("ชื่อสินค้ายาวเกิน 160 ตัวอักษร");
    const money = (v: string | undefined, label: string) => {
      try { return v ? bahtToSatang(v) : null; } catch { errors.push(`${label} ไม่ถูกต้อง`); return null; }
    };
    const barcode = r.barcode?.trim() || null;
    if (barcode && !/^[0-9A-Za-z-]{4,32}$/.test(barcode)) errors.push("บาร์โค้ดไม่ถูกต้อง");
    const packSize = intField(r.packSize, "จำนวนต่อแพ็ก", errors, 1);
    const data: ImportRow = {
      sku, name, category: r.category?.slice(0, 80) || null, brand: r.brand?.slice(0, 80) || null, unit: r.unit?.slice(0, 20) || null,
      packSize, costSatang: money(r.cost, "ราคาทุน"), priceSatang: money(r.price, "ราคาขาย"),
      reorderPoint: intField(r.reorderPoint, "จุดสั่งซื้อ", errors), reorderQty: intField(r.reorderQty, "จำนวนสั่งต่อครั้ง", errors),
      supplier: r.supplier?.slice(0, 120) || null, barcode, location: r.location?.slice(0, 60) || null,
      receiveQty: intField(r.receiveQty, "จำนวนรับเข้า", errors), note: r.note?.slice(0, 500) || null,
    };
    return { rowNo, data, errors };
  });
}

export async function templateWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("สินค้า");
  ws.addRow(TEMPLATE_COLUMNS.map(([, th]) => th));
  ws.addRow(["WATER-600", "น้ำดื่ม 600 มล.", "เครื่องดื่ม", "ตัวอย่างแบรนด์", "ขวด", 12, 5.5, 10, 24, 48, "ร้านส่งน้ำ ก", "8850000000001", "คลังสินค้า", 48, "แถวตัวอย่าง ลบได้"]);
  ws.addRow(["BALL-3", "ลูกเทนนิส (กระป๋อง 3 ลูก)", "อุปกรณ์เทนนิส", "ตัวอย่างแบรนด์", "กระป๋อง", 1, 120, 180, 5, 12, "", "", "คลังสินค้า", 10, ""]);
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => { c.width = 18; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
