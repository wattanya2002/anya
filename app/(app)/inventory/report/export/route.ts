import ExcelJS from "exceljs";
import { getCurrentUser, can } from "@/lib/auth";
import { inventoryReport, listMovements, suggestedOrderQty } from "@/lib/inventory";
import { reportRange } from "@/lib/report-range";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "inventory.view")) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const range = reportRange({ from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined });
  const r = await inventoryReport(user.orgId, range.from, range.to);
  const moves = await listMovements(user.orgId, { from: range.from, to: range.to, limit: 500 });
  const wb = new ExcelJS.Workbook();
  wb.creator = "Wonder Courts";
  const sum = wb.addWorksheet("สรุป");
  sum.addRows([
    ["สรุปสต็อก", user.orgName], ["ช่วงเวลา", `${range.from} ถึง ${range.to}`], ["สินค้าทั้งหมด", r.products.length],
    ["มูลค่าคงเหลือ (บาท, ราคาทุน)", r.valueSatang / 100], ["ใกล้หมด", r.attention.filter((p) => p.status === "low").length],
    ["หมด", r.attention.filter((p) => p.status === "out").length], [], ["การเคลื่อนไหว", "ครั้ง", "จำนวน", "มูลค่า (บาท)"],
    ...r.types.map((t) => [t.typeTh, t.count, t.qty, t.valueSatang / 100]),
    [], ["สร้างเมื่อ", new Date().toISOString()], ["หมายเหตุ", "ข้อมูลจากการบันทึกในระบบ Wonder Courts เท่านั้น"],
  ]);
  sum.getColumn(1).width = 30; sum.getColumn(2).width = 22;
  const stock = wb.addWorksheet("คงเหลือ");
  stock.addRow(["SKU", "สินค้า", "ประเภท", "ยี่ห้อ", ...r.locations.map((l) => l.name), "รวม", "หน่วย", "ทุน/หน่วย (บาท)", "มูลค่า (บาท)", "จุดสั่งซื้อ", "แนะนำสั่ง", "ซัพพลายเออร์", "สถานะ"]);
  for (const p of r.products) {
    stock.addRow([p.sku, p.name, p.category ?? "", p.brand ?? "", ...r.locations.map((l) => p.byLocation[l.id] ?? 0), p.total, p.unit,
      p.costSatang / 100, (p.total * p.costSatang) / 100, p.reorderPoint, p.status === "ok" ? "" : suggestedOrderQty(p), p.supplier ?? "",
      p.status === "out" ? "หมด" : p.status === "low" ? "ใกล้หมด" : "ปกติ"]);
  }
  const mv = wb.addWorksheet("การเคลื่อนไหว");
  mv.addRow(["เวลา", "SKU", "สินค้า", "รายการ", "ที่เก็บ", "จำนวน", "คงเหลือหลังทำ", "ผู้ทำ", "เลขอ้างอิง", "หมายเหตุ"]);
  for (const m of moves) mv.addRow([m.createdAt, m.sku, m.product, m.typeTh, m.location, m.qtyDelta, m.balanceAfter, m.actor ?? "", m.reference ?? "", m.note ?? ""]);
  for (const ws of [stock, mv]) { ws.getRow(1).font = { bold: true }; ws.columns.forEach((c) => { c.width = 16; }); }
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventory-report-${range.from}-${range.to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
