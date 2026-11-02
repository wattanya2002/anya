"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PoolClient } from "pg";
import { getCurrentUser, can, type CurrentUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import {
  StockError, recordMovement, transferStock, setCountedQty, ensureDefaultLocations,
  normalizeLine, normalizePhone, bahtToSatang, type MovementType,
} from "@/lib/inventory-core";
import { upsertNamed } from "@/lib/inventory";
import { parseUpload, validateRows, type ImportRow } from "@/lib/inventory-import";
import type { FormState } from "@/app/actions";

async function writer(): Promise<CurrentUser | string> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!can(user, "inventory.manage")) return "ไม่มีสิทธิ์แก้ไขข้อมูลสต็อก";
  return user;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const intOr = (v: string, d: number) => (v === "" ? d : Number(v));
const uuid = z.string().uuid();
const fieldsOf = (f: FormData) => Object.fromEntries([...f.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$")).map(([k, v]) => [k, String(v)]));

function friendly(err: unknown): string {
  if (err instanceof StockError) return err.message;
  const e = err as { code?: string; constraint?: string };
  if (e?.code === "23505" && /sku/.test(e.constraint ?? "")) return "รหัสสินค้า (SKU) นี้มีอยู่แล้ว";
  if (e?.code === "23505" && /suppliers/.test(e.constraint ?? "")) return "มีซัพพลายเออร์ชื่อนี้อยู่แล้ว";
  if (e?.code === "23514") return "ข้อมูลบางช่องไม่อยู่ในรูปแบบที่กำหนด";
  console.error("inventory action failed", err);
  return "บันทึกไม่สำเร็จ กรุณาลองใหม่";
}

async function audit(c: PoolClient, u: CurrentUser, action: string, entity: string, id: string, before: unknown, after: unknown) {
  await c.query(
    `insert into audit_events (org_id, actor_user_id, action, entity_type, entity_id, before, after) values ($1,$2,$3,$4,$5,$6,$7)`,
    [u.orgId, u.id, action, entity, id, before ?? null, after ?? null],
  );
}

// ------------------------------------------------------------------ products
const productSchema = z.object({
  sku: z.string().regex(/^[A-Za-z0-9._-]{1,40}$/, "SKU ใช้ได้เฉพาะ A-Z 0-9 . _ - (ไม่เกิน 40 ตัว)"),
  name: z.string().min(1, "กรุณากรอกชื่อสินค้า").max(160),
  unit: z.string().min(1, "กรุณาระบุหน่วย").max(20),
  packSize: z.number().int("จำนวนต่อแพ็กต้องเป็นจำนวนเต็ม").min(1).max(10000),
  reorderPoint: z.number().int().min(0, "จุดสั่งซื้อต้องไม่ติดลบ").max(1_000_000),
  reorderQty: z.number().int().min(0).max(1_000_000),
  barcode: z.string().regex(/^[0-9A-Za-z-]{4,32}$/, "บาร์โค้ดไม่ถูกต้อง").or(z.literal("")),
  note: z.string().max(500),
});

export async function saveProduct(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await writer();
  const fields = fieldsOf(form);
  if (typeof u === "string") return { error: u, fields };
  try {
    const id = str(form, "id");
    const parsed = productSchema.safeParse({
      sku: str(form, "sku"), name: str(form, "name"), unit: str(form, "unit") || "ชิ้น",
      packSize: intOr(str(form, "packSize"), 1), reorderPoint: intOr(str(form, "reorderPoint"), 0),
      reorderQty: intOr(str(form, "reorderQty"), 0), barcode: str(form, "barcode"), note: str(form, "note"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
    const cost = bahtToSatang(str(form, "cost")) ?? 0;
    const price = bahtToSatang(str(form, "price"));
    const supplierId = str(form, "supplierId");
    if (supplierId && !uuid.safeParse(supplierId).success) return { error: "ซัพพลายเออร์ไม่ถูกต้อง", fields };
    const openingQty = intOr(str(form, "openingQty"), 0);
    if (!Number.isInteger(openingQty) || openingQty < 0) return { error: "ยอดเริ่มต้นต้องเป็นจำนวนเต็ม ≥ 0", fields };
    const openingLocation = str(form, "openingLocation");
    const isActive = id ? form.get("isActive") === "on" : true;

    const savedId = await withTransaction(async (c) => {
      const categoryId = await upsertNamed(c, "product_categories", u.orgId, str(form, "category"));
      const brandId = await upsertNamed(c, "brands", u.orgId, str(form, "brand"));
      if (supplierId) {
        const ok = await c.query(`select 1 from suppliers where id = $1 and org_id = $2`, [supplierId, u.orgId]);
        if (!ok.rows[0]) throw new StockError("NOT_FOUND", "ไม่พบซัพพลายเออร์");
      }
      const d = parsed.data;
      const values = [u.orgId, d.sku, d.name, categoryId, brandId, supplierId || null, d.unit, d.packSize, cost, price,
        d.reorderPoint, d.reorderQty, d.barcode || null, d.note || null, isActive];
      if (id) {
        if (!uuid.safeParse(id).success) throw new StockError("NOT_FOUND", "ไม่พบสินค้า");
        const before = await c.query(`select * from products where id = $1 and org_id = $2 for update`, [id, u.orgId]);
        if (!before.rows[0]) throw new StockError("NOT_FOUND", "ไม่พบสินค้า");
        await c.query(
          `update products set sku=$2, name=$3, category_id=$4, brand_id=$5, supplier_id=$6, unit=$7, pack_size=$8, cost_satang=$9,
                  price_satang=$10, reorder_point=$11, reorder_qty=$12, barcode=$13, note=$14, is_active=$15, updated_at=now()
            where id=$16 and org_id=$1`, [...values, id]);
        await audit(c, u, "product.updated", "product", id, before.rows[0], Object.fromEntries(Object.entries(fields).filter(([k]) => k !== "id")));
        return id;
      }
      const ins = await c.query(
        `insert into products (org_id, sku, name, category_id, brand_id, supplier_id, unit, pack_size, cost_satang, price_satang,
                               reorder_point, reorder_qty, barcode, note, is_active, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id`, [...values, u.id]);
      const newId = ins.rows[0].id as string;
      await audit(c, u, "product.created", "product", newId, null, fields);
      if (openingQty > 0) {
        await ensureDefaultLocations(c, u.orgId);
        const loc = openingLocation && uuid.safeParse(openingLocation).success ? openingLocation
          : (await c.query(`select id from inventory_locations where org_id = $1 order by sort_order limit 1`, [u.orgId])).rows[0].id;
        await recordMovement(c, { orgId: u.orgId, productId: newId, locationId: loc, type: "OPENING", qty: openingQty, actorUserId: u.id, unitCostSatang: cost, note: "ยอดเริ่มต้นตอนเพิ่มสินค้า" });
      }
      return newId;
    });
    revalidatePath("/inventory", "layout");
    return { ok: id ? "บันทึกการแก้ไขแล้ว" : "เพิ่มสินค้าแล้ว", nonce: savedId + Date.now() };
  } catch (err) {
    return { error: friendly(err), fields };
  }
}

// ------------------------------------------------------------------ stock movements
const OPS = ["RECEIVE", "ISSUE", "SALE", "DAMAGE", "EXPIRED", "TRANSFER", "COUNT"] as const;

export async function recordStock(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await writer();
  const fields = fieldsOf(form);
  if (typeof u === "string") return { error: u, fields };
  const op = str(form, "op") as (typeof OPS)[number];
  const productId = str(form, "productId");
  const locationId = str(form, "locationId");
  const qty = Number(str(form, "qty"));
  const idem = str(form, "idem").slice(0, 64) || null;
  if (!OPS.includes(op)) return { error: "กรุณาเลือกประเภทรายการ", fields };
  if (!uuid.safeParse(productId).success) return { error: "กรุณาเลือกสินค้า", fields };
  if (!uuid.safeParse(locationId).success) return { error: "กรุณาเลือกที่เก็บ", fields };
  if (!Number.isInteger(qty) || qty < 0 || (op !== "COUNT" && qty === 0)) {
    return { error: op === "COUNT" ? "จำนวนที่นับได้ต้องเป็นจำนวนเต็ม ≥ 0" : "จำนวนต้องเป็นจำนวนเต็มมากกว่า 0", fields };
  }
  const note = str(form, "note").slice(0, 300) || null;
  const reference = str(form, "reference").slice(0, 80) || null;
  try {
    let unitCost: number | null = null;
    if (op === "RECEIVE" && str(form, "unitCost")) unitCost = bahtToSatang(str(form, "unitCost"));
    const result = await withTransaction(async (c) => {
      if (op === "TRANSFER") {
        const to = str(form, "toLocationId");
        if (!uuid.safeParse(to).success) throw new StockError("INVALID", "กรุณาเลือกที่เก็บปลายทาง");
        return transferStock(c, { orgId: u.orgId, productId, fromLocationId: locationId, toLocationId: to, qty, actorUserId: u.id, note, idempotencyKey: idem });
      }
      if (op === "COUNT") return setCountedQty(c, { orgId: u.orgId, productId, locationId, countedQty: qty, actorUserId: u.id, note, idempotencyKey: idem });
      const r = await recordMovement(c, { orgId: u.orgId, productId, locationId, type: op as MovementType, qty, actorUserId: u.id, note, reference, unitCostSatang: unitCost, idempotencyKey: idem });
      if (op === "RECEIVE" && unitCost !== null && !r.duplicate) {
        await c.query(`update products set cost_satang = $3, updated_at = now() where id = $1 and org_id = $2`, [productId, u.orgId, unitCost]);
      }
      return r;
    });
    revalidatePath("/inventory", "layout");
    const msg = op === "COUNT" && result === null ? "ยอดตรงกับระบบ ไม่ต้องปรับ" : "บันทึกแล้ว";
    return { ok: msg, nonce: String(Date.now()) };
  } catch (err) {
    return { error: friendly(err), fields };
  }
}

// ------------------------------------------------------------------ suppliers
export async function saveSupplier(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await writer();
  const fields = fieldsOf(form);
  if (typeof u === "string") return { error: u, fields };
  try {
    const id = str(form, "id");
    const name = str(form, "name");
    if (!name) return { error: "กรุณากรอกชื่อซัพพลายเออร์", fields };
    if (name.length > 120) return { error: "ชื่อยาวเกิน 120 ตัวอักษร", fields };
    const phone = normalizePhone(str(form, "phone"));
    const line = normalizeLine(str(form, "line"));
    const lead = str(form, "leadTimeDays");
    const leadDays = lead === "" ? null : Number(lead);
    if (leadDays !== null && (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 365)) return { error: "ระยะเวลารอของต้องเป็น 0–365 วัน", fields };
    const values = [u.orgId, name, str(form, "contactName").slice(0, 80) || null, phone, line, leadDays, str(form, "note").slice(0, 500) || null];
    const saved = await withTransaction(async (c) => {
      if (id) {
        if (!uuid.safeParse(id).success) throw new StockError("NOT_FOUND", "ไม่พบซัพพลายเออร์");
        const before = await c.query(`select * from suppliers where id = $1 and org_id = $2 for update`, [id, u.orgId]);
        if (!before.rows[0]) throw new StockError("NOT_FOUND", "ไม่พบซัพพลายเออร์");
        await c.query(`update suppliers set name=$2, contact_name=$3, phone=$4, line_url=$5, lead_time_days=$6, note=$7, is_active=$8, updated_at=now()
                        where id=$9 and org_id=$1`, [...values, form.get("isActive") === "on", id]);
        await audit(c, u, "supplier.updated", "supplier", id, before.rows[0], fields);
        return id;
      }
      const ins = await c.query(`insert into suppliers (org_id, name, contact_name, phone, line_url, lead_time_days, note) values ($1,$2,$3,$4,$5,$6,$7) returning id`, values);
      await audit(c, u, "supplier.created", "supplier", ins.rows[0].id, null, fields);
      return ins.rows[0].id as string;
    });
    revalidatePath("/inventory", "layout");
    return { ok: id ? "บันทึกการแก้ไขแล้ว" : "เพิ่มซัพพลายเออร์แล้ว", nonce: saved + Date.now() };
  } catch (err) {
    return { error: friendly(err), fields };
  }
}

// ------------------------------------------------------------------ import (upload → preview → confirm)
const MAX_BYTES = 2 * 1024 * 1024;

export async function uploadImport(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await writer();
  if (typeof u === "string") return { error: u };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "กรุณาเลือกไฟล์ .xlsx หรือ .csv" };
  if (file.size > MAX_BYTES) return { error: "ไฟล์ใหญ่เกิน 2 MB" };
  const name = file.name.slice(0, 120);
  let jobId: string;
  try {
    const raw = await parseUpload(name, Buffer.from(await file.arrayBuffer()));
    if (raw.length === 0) return { error: "ไม่พบข้อมูลในไฟล์ (แถวแรกต้องเป็นหัวคอลัมน์)" };
    if (raw.length > 2000) return { error: "นำเข้าได้ครั้งละไม่เกิน 2,000 แถว" };
    const rows = validateRows(raw);
    jobId = await withTransaction(async (c) => {
      const job = await c.query(
        `insert into import_jobs (org_id, kind, source, status, file_name, row_count, error_count, created_by)
         values ($1, 'products', 'import', 'validating', $2, $3, $4, $5) returning id`,
        [u.orgId, name, rows.length, rows.filter((r) => r.errors.length).length, u.id]);
      const id = job.rows[0].id as string;
      for (const r of rows) {
        await c.query(`insert into import_rows (import_job_id, row_no, data, errors) values ($1,$2,$3,$4)`, [id, r.rowNo, r.data, JSON.stringify(r.errors)]);
      }
      return id;
    });
  } catch (err) {
    return { error: err instanceof StockError ? err.message : "อ่านไฟล์ไม่สำเร็จ กรุณาใช้ไฟล์แม่แบบ (.xlsx หรือ .csv UTF-8)" };
  }
  redirect(`/inventory/import?job=${jobId}`);
}

export async function confirmImport(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await writer();
  if (typeof u === "string") return { error: u };
  const jobId = str(form, "jobId");
  if (!uuid.safeParse(jobId).success) return { error: "ไม่พบงานนำเข้า" };
  try {
    const summary = await withTransaction(async (c) => {
      const job = await c.query(`select status from import_jobs where id = $1 and org_id = $2 and kind = 'products' for update`, [jobId, u.orgId]);
      if (!job.rows[0]) throw new StockError("NOT_FOUND", "ไม่พบงานนำเข้า");
      if (job.rows[0].status === "completed") throw new StockError("INVALID", "งานนำเข้านี้ยืนยันไปแล้ว");
      if (job.rows[0].status !== "validating") throw new StockError("INVALID", "งานนำเข้านี้ถูกยกเลิกแล้ว");
      await ensureDefaultLocations(c, u.orgId);
      const locs = (await c.query(`select id, name from inventory_locations where org_id = $1 order by sort_order`, [u.orgId])).rows;
      const rows = (await c.query(`select row_no, data from import_rows where import_job_id = $1 and errors = '[]'::jsonb order by row_no`, [jobId])).rows;
      let created = 0, updated = 0, received = 0;
      for (const { row_no, data } of rows as { row_no: number; data: ImportRow }[]) {
        const categoryId = await upsertNamed(c, "product_categories", u.orgId, data.category);
        const brandId = await upsertNamed(c, "brands", u.orgId, data.brand);
        let supplierId: string | null = null;
        if (data.supplier) {
          const s = await c.query(`select id from suppliers where org_id = $1 and lower(name) = lower($2)`, [u.orgId, data.supplier]);
          supplierId = s.rows[0]?.id ?? (await c.query(`insert into suppliers (org_id, name) values ($1,$2) returning id`, [u.orgId, data.supplier])).rows[0].id;
        }
        const existing = await c.query(`select id from products where org_id = $1 and lower(sku) = lower($2) for update`, [u.orgId, data.sku]);
        let productId: string;
        if (existing.rows[0]) {
          productId = existing.rows[0].id;
          await c.query(
            `update products set name=$3, category_id=coalesce($4, category_id), brand_id=coalesce($5, brand_id), supplier_id=coalesce($6, supplier_id),
                    unit=coalesce($7, unit), pack_size=coalesce($8, pack_size), cost_satang=coalesce($9, cost_satang), price_satang=coalesce($10, price_satang),
                    reorder_point=coalesce($11, reorder_point), reorder_qty=coalesce($12, reorder_qty), barcode=coalesce($13, barcode),
                    note=coalesce($14, note), is_active = true, updated_at=now()
              where id=$1 and org_id=$2`,
            [productId, u.orgId, data.name, categoryId, brandId, supplierId, data.unit, data.packSize, data.costSatang, data.priceSatang,
             data.reorderPoint, data.reorderQty, data.barcode, data.note]);
          updated++;
        } else {
          productId = (await c.query(
            `insert into products (org_id, sku, name, category_id, brand_id, supplier_id, unit, pack_size, cost_satang, price_satang,
                                   reorder_point, reorder_qty, barcode, note, created_by)
             values ($1,$2,$3,$4,$5,$6,coalesce($7,'ชิ้น'),coalesce($8,1),coalesce($9,0),$10,coalesce($11,0),coalesce($12,0),$13,$14,$15) returning id`,
            [u.orgId, data.sku, data.name, categoryId, brandId, supplierId, data.unit, data.packSize, data.costSatang, data.priceSatang,
             data.reorderPoint, data.reorderQty, data.barcode, data.note, u.id])).rows[0].id;
          created++;
        }
        if (data.receiveQty && data.receiveQty > 0) {
          const loc = data.location ? locs.find((l) => l.name.toLowerCase() === data.location!.toLowerCase()) : locs[0];
          if (!loc) throw new StockError("INVALID", `แถว ${row_no}: ไม่พบที่เก็บ “${data.location}”`);
          await recordMovement(c, { orgId: u.orgId, productId, locationId: loc.id, type: "RECEIVE", qty: data.receiveQty, actorUserId: u.id,
            unitCostSatang: data.costSatang, note: "นำเข้าจากไฟล์", importJobId: jobId, idempotencyKey: `import:${jobId}:${row_no}` });
          received++;
        }
      }
      await c.query(`update import_jobs set status = 'completed', finished_at = now() where id = $1`, [jobId]);
      await audit(c, u, "import.products_confirmed", "import_job", jobId, null, { created, updated, received });
      return { created, updated, received };
    });
    revalidatePath("/inventory", "layout");
    return { ok: `นำเข้าแล้ว: เพิ่มใหม่ ${summary.created} · อัปเดต ${summary.updated} · รับเข้าสต็อก ${summary.received} รายการ` };
  } catch (err) {
    return { error: friendly(err) };
  }
}

export async function cancelImport(form: FormData) {
  const u = await writer();
  if (typeof u === "string") return;
  const jobId = str(form, "jobId");
  if (!uuid.safeParse(jobId).success) return;
  await withTransaction(async (c) => {
    await c.query(`update import_jobs set status = 'rolled_back', finished_at = now() where id = $1 and org_id = $2 and status = 'validating'`, [jobId, u.orgId]);
  });
  redirect("/inventory/import");
}
