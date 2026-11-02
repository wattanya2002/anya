import "server-only";
import { db, withTransaction } from "./db";
import { ensureDefaultLocations, MOVEMENT_TH, type MovementType } from "./inventory-core";
import { formatBahtFromSatang, formatInt } from "./format";

export type Location = { id: string; name: string; kind: string };
export type Option = { id: string; name: string };
export type Supplier = {
  id: string; name: string; contactName: string | null; phone: string | null; lineUrl: string | null;
  leadTimeDays: number | null; note: string | null; isActive: boolean; productCount: number;
};
export type StockStatus = "out" | "low" | "ok";
export type ProductRow = {
  id: string; sku: string; name: string; unit: string; packSize: number; costSatang: number; priceSatang: number | null;
  reorderPoint: number; reorderQty: number; barcode: string | null; note: string | null; isActive: boolean;
  categoryId: string | null; category: string | null; brandId: string | null; brand: string | null;
  supplierId: string | null; supplier: string | null; supplierPhone: string | null; supplierLine: string | null;
  byLocation: Record<string, number>; total: number; status: StockStatus;
};

export async function getLocations(orgId: string): Promise<Location[]> {
  const c = await db().connect();
  try { await ensureDefaultLocations(c, orgId); } finally { c.release(); }
  const { rows } = await db().query(
    `select id, name, kind from inventory_locations where org_id = $1 and is_active order by sort_order, name`, [orgId]);
  return rows;
}

export async function getLookups(orgId: string) {
  const [cats, brands, sups] = await Promise.all([
    db().query(`select id, name from product_categories where org_id = $1 order by sort_order, name`, [orgId]),
    db().query(`select id, name from brands where org_id = $1 order by name`, [orgId]),
    db().query(`select id, name from suppliers where org_id = $1 and is_active order by name`, [orgId]),
  ]);
  return { categories: cats.rows as Option[], brands: brands.rows as Option[], suppliers: sups.rows as Option[] };
}

export function statusOf(total: number, reorderPoint: number): StockStatus {
  if (total <= 0) return "out";
  if (reorderPoint > 0 && total <= reorderPoint) return "low";
  return "ok";
}

export type ProductFilter = { q?: string; category?: string; brand?: string; supplier?: string; status?: string; includeInactive?: boolean };

export async function listProducts(orgId: string, f: ProductFilter = {}): Promise<ProductRow[]> {
  const params: unknown[] = [orgId];
  const where: string[] = ["p.org_id = $1"];
  if (!f.includeInactive) where.push("p.is_active");
  if (f.q) {
    params.push(`%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    where.push(`(p.name ilike $${params.length} or p.sku ilike $${params.length} or coalesce(p.barcode,'') ilike $${params.length} or b.name ilike $${params.length})`);
  }
  for (const [key, col] of [["category", "p.category_id"], ["brand", "p.brand_id"], ["supplier", "p.supplier_id"]] as const) {
    const v = f[key];
    if (v && /^[0-9a-f-]{36}$/i.test(v)) { params.push(v); where.push(`${col} = $${params.length}`); }
  }
  const { rows } = await db().query(
    `select p.id, p.sku, p.name, p.unit, p.pack_size, p.cost_satang, p.price_satang, p.reorder_point, p.reorder_qty,
            p.barcode, p.note, p.is_active, p.category_id, c.name as category, p.brand_id, b.name as brand,
            p.supplier_id, s.name as supplier, s.phone as supplier_phone, s.line_url as supplier_line,
            coalesce(jsonb_object_agg(sb.location_id, sb.qty) filter (where sb.location_id is not null), '{}') as by_location,
            coalesce(sum(sb.qty), 0)::int as total
       from products p
       left join product_categories c on c.id = p.category_id
       left join brands b on b.id = p.brand_id
       left join suppliers s on s.id = p.supplier_id
       left join stock_balances sb on sb.product_id = p.id
      where ${where.join(" and ")}
      group by p.id, c.name, b.name, s.name, s.phone, s.line_url
      order by c.name nulls last, p.name`,
    params,
  );
  let list: ProductRow[] = rows.map((r) => ({
    id: r.id, sku: r.sku, name: r.name, unit: r.unit, packSize: r.pack_size, costSatang: Number(r.cost_satang),
    priceSatang: r.price_satang === null ? null : Number(r.price_satang), reorderPoint: r.reorder_point, reorderQty: r.reorder_qty,
    barcode: r.barcode, note: r.note, isActive: r.is_active, categoryId: r.category_id, category: r.category,
    brandId: r.brand_id, brand: r.brand, supplierId: r.supplier_id, supplier: r.supplier, supplierPhone: r.supplier_phone,
    supplierLine: r.supplier_line, byLocation: r.by_location, total: r.total, status: statusOf(r.total, r.reorder_point),
  }));
  if (f.status === "low") list = list.filter((p) => p.status === "low");
  else if (f.status === "out") list = list.filter((p) => p.status === "out");
  else if (f.status === "attention") list = list.filter((p) => p.status !== "ok");
  return list;
}

export function suggestedOrderQty(p: Pick<ProductRow, "reorderQty" | "reorderPoint" | "total" | "packSize">): number {
  const raw = p.reorderQty > 0 ? p.reorderQty : Math.max(p.reorderPoint * 2 - p.total, p.packSize);
  return Math.max(p.packSize, Math.ceil(raw / p.packSize) * p.packSize);
}

export async function listSuppliers(orgId: string): Promise<Supplier[]> {
  const { rows } = await db().query(
    `select s.*, (select count(*)::int from products p where p.supplier_id = s.id and p.is_active) as product_count
       from suppliers s where s.org_id = $1 order by s.is_active desc, s.name`, [orgId]);
  return rows.map((r) => ({
    id: r.id, name: r.name, contactName: r.contact_name, phone: r.phone, lineUrl: r.line_url, leadTimeDays: r.lead_time_days,
    note: r.note, isActive: r.is_active, productCount: r.product_count,
  }));
}

export type MovementRow = {
  id: number; createdAt: Date; type: MovementType; typeTh: string; qtyDelta: number; balanceAfter: number;
  product: string; sku: string; unit: string; location: string; note: string | null; reference: string | null; actor: string | null;
};

export async function listMovements(orgId: string, opts: { limit?: number; productId?: string; from?: string; to?: string } = {}): Promise<MovementRow[]> {
  const params: unknown[] = [orgId];
  const where = ["m.org_id = $1"];
  if (opts.productId) { params.push(opts.productId); where.push(`m.product_id = $${params.length}`); }
  if (opts.from) { params.push(opts.from); where.push(`(m.created_at at time zone 'Asia/Bangkok')::date >= $${params.length}::date`); }
  if (opts.to) { params.push(opts.to); where.push(`(m.created_at at time zone 'Asia/Bangkok')::date <= $${params.length}::date`); }
  params.push(Math.min(opts.limit ?? 50, 500));
  const { rows } = await db().query(
    `select m.id, m.created_at, m.type, m.qty_delta, m.balance_after, m.note, m.reference, p.name as product, p.sku, p.unit,
            l.name as location, u.display_name as actor
       from stock_movements m join products p on p.id = m.product_id join inventory_locations l on l.id = m.location_id
       left join users u on u.id = m.actor_user_id
      where ${where.join(" and ")} order by m.created_at desc, m.id desc limit $${params.length}`, params);
  return rows.map((r) => ({
    id: Number(r.id), createdAt: new Date(r.created_at), type: r.type, typeTh: MOVEMENT_TH[r.type as MovementType], qtyDelta: r.qty_delta,
    balanceAfter: r.balance_after, product: r.product, sku: r.sku, unit: r.unit, location: r.location, note: r.note, reference: r.reference, actor: r.actor,
  }));
}

export async function inventoryOverview(orgId: string) {
  const products = await listProducts(orgId);
  const valueSatang = products.reduce((s, p) => s + p.total * p.costSatang, 0);
  const attention = products.filter((p) => p.status !== "ok").sort((a, b) => (a.status === b.status ? a.total - b.total : a.status === "out" ? -1 : 1));
  const byCategory = new Map<string, { name: string; items: number; qty: number; valueSatang: number }>();
  for (const p of products) {
    const key = p.category ?? "ไม่ระบุประเภท";
    const e = byCategory.get(key) ?? { name: key, items: 0, qty: 0, valueSatang: 0 };
    e.items += 1; e.qty += p.total; e.valueSatang += p.total * p.costSatang;
    byCategory.set(key, e);
  }
  return {
    productCount: products.length,
    valueSatang,
    lowCount: products.filter((p) => p.status === "low").length,
    outCount: products.filter((p) => p.status === "out").length,
    attention,
    byCategory: [...byCategory.values()].sort((a, b) => b.valueSatang - a.valueSatang),
    recent: await listMovements(orgId, { limit: 15 }),
  };
}

/** Manager summary for a period (Bangkok calendar dates, inclusive). */
export async function inventoryReport(orgId: string, from: string, to: string) {
  const products = await listProducts(orgId);
  const locations = await getLocations(orgId);
  const byType = await db().query(
    `select m.type, count(*)::int as n, sum(abs(m.qty_delta))::int as qty, sum(abs(m.qty_delta) * p.cost_satang)::bigint as value
       from stock_movements m join products p on p.id = m.product_id
      where m.org_id = $1 and (m.created_at at time zone 'Asia/Bangkok')::date between $2::date and $3::date
      group by m.type order by m.type`, [orgId, from, to]);
  const topOut = await db().query(
    `select p.name, p.unit, sum(-m.qty_delta)::int as qty, sum(-m.qty_delta * p.cost_satang)::bigint as value
       from stock_movements m join products p on p.id = m.product_id
      where m.org_id = $1 and m.type in ('ISSUE','SALE','DAMAGE','EXPIRED')
        and (m.created_at at time zone 'Asia/Bangkok')::date between $2::date and $3::date
      group by p.id order by qty desc limit 10`, [orgId, from, to]);
  const valueSatang = products.reduce((s, p) => s + p.total * p.costSatang, 0);
  const attention = products.filter((p) => p.status !== "ok");
  const types = byType.rows.map((r) => ({ type: r.type as MovementType, typeTh: MOVEMENT_TH[r.type as MovementType], count: r.n, qty: r.qty, valueSatang: Number(r.value) }));
  return { from, to, products, locations, valueSatang, attention, types, topOut: topOut.rows.map((r) => ({ ...r, value: Number(r.value) })) };
}

export function reportText(r: Awaited<ReturnType<typeof inventoryReport>>, orgName: string, generatedAt: Date): string {
  const d = (iso: string) => new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const lines = [
    `สรุปสต็อก ${orgName}`,
    `ช่วง ${d(r.from)} – ${d(r.to)}`,
    "",
    `• สินค้าทั้งหมด ${formatInt(r.products.length)} รายการ · มูลค่าคงเหลือ (ราคาทุน) ${formatBahtFromSatang(r.valueSatang)}`,
    `• ใกล้หมด ${r.attention.filter((p) => p.status === "low").length} · หมด ${r.attention.filter((p) => p.status === "out").length}`,
  ];
  if (r.types.length) {
    lines.push("", "การเคลื่อนไหวในช่วงนี้:");
    for (const t of r.types) lines.push(`• ${t.typeTh}: ${formatInt(t.qty)} หน่วย (${t.count} ครั้ง) ≈ ${formatBahtFromSatang(t.valueSatang)}`);
  } else lines.push("", "ไม่มีการเคลื่อนไหวในช่วงนี้");
  if (r.topOut.length) {
    lines.push("", "ใช้/ขายมากสุด:");
    r.topOut.slice(0, 5).forEach((t, i) => lines.push(`${i + 1}. ${t.name} ${formatInt(t.qty)} ${t.unit}`));
  }
  if (r.attention.length) {
    lines.push("", "ต้องสั่งเพิ่ม:");
    for (const p of r.attention.slice(0, 15)) {
      lines.push(`• ${p.name} คงเหลือ ${formatInt(p.total)} ${p.unit}${p.status === "out" ? " (หมด)" : ""} → แนะนำสั่ง ${formatInt(suggestedOrderQty(p))} ${p.unit}${p.supplier ? ` · ${p.supplier}` : ""}`);
    }
    if (r.attention.length > 15) lines.push(`…และอีก ${r.attention.length - 15} รายการ`);
  }
  lines.push("", `สร้างเมื่อ ${new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(generatedAt)} จากระบบ Wonder Courts`);
  return lines.join("\n");
}

export async function upsertNamed(c: import("pg").PoolClient, table: "product_categories" | "brands", orgId: string, name: string | null): Promise<string | null> {
  const n = name?.trim();
  if (!n) return null;
  const found = await c.query(`select id from ${table} where org_id = $1 and lower(name) = lower($2)`, [orgId, n]);
  if (found.rows[0]) return found.rows[0].id;
  const ins = await c.query(`insert into ${table} (org_id, name) values ($1, $2) on conflict do nothing returning id`, [orgId, n.slice(0, 80)]);
  if (ins.rows[0]) return ins.rows[0].id;
  return (await c.query(`select id from ${table} where org_id = $1 and lower(name) = lower($2)`, [orgId, n])).rows[0].id;
}

export { withTransaction };
